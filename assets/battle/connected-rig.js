/* Continuous deformation of a Cubism surface. Shared vertices cannot separate at part boundaries. */
(()=>{
 const clamp=x=>Math.max(0,Math.min(1,x));
 const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
 function capsule(x,y,a,b,r){
  const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1));
  return {t,w:smooth(1-Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t)/r)};
 }
 function subdivide(source,triangles,levels=2){
  const positions=Array.from(source);let indices=Array.from(triangles);
  for(let pass=0;pass<levels;pass++){
   const edges=new Map(),next=[];
   const middle=(a,b)=>{const key=a<b?a+':'+b:b+':'+a;if(edges.has(key))return edges.get(key);const i=positions.length/2;positions.push((positions[a*2]+positions[b*2])/2,(positions[a*2+1]+positions[b*2+1])/2);edges.set(key,i);return i};
   for(let j=0;j<indices.length;j+=3){const [a,b,c]=indices.slice(j,j+3),ab=middle(a,b),bc=middle(b,c),ca=middle(c,a);next.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca)}indices=next;
  }
  return {positions:new Float32Array(positions),indices:new Uint16Array(indices)};
 }
 function pose(time,action){
  if(!action)return {prepare:0,hit:0,settle:0};
  const elapsed=time-action.start,w=action.windup/1000,d=action.total/1000;
  if(elapsed<0||elapsed>d)return {prepare:0,hit:0,settle:0};
  const after=elapsed-w;
  const prepare=elapsed<w?Math.sin(Math.PI*.5*clamp(elapsed/w)):Math.exp(-after*24);
  const hit=after>=0?Math.exp(-after*11)*Math.sin(Math.min(1,after/.07)*Math.PI*.5):0;
  return {prepare,hit,settle:after>=0?Math.sin(after*14)*Math.exp(-after*5):0};
 }
 function deform(base,out,aspect,profile,time,phase,action,gain=1){
  const p=profile,gesture=pose(time,action),power=action?.strength||1;
  const breath=Math.sin(time*1.45+phase),hair=Math.sin(time*1.2+phase+.7),cloth=Math.sin(time*.91+phase-1);
  for(let i=0;i<base.length;i+=2){
   const x=base[i]+.5,y=.5-base[i+1]/aspect;
   const upper=smooth((.9-y)/.65),foot=smooth((.985-y)/.07);
   const torso=smooth(1-Math.abs(x-p.center)/.28)*smooth(1-Math.abs(y-.43)/.3);
   let dx=(x-p.center)*breath*.005*torso,dy=breath*.0009*torso;
   const hw=capsule(x,y,p.hairRoot,p.hairTip,p.hairWidth);
   const hairLag=Math.sin(time*1.2+phase+.7-hw.t*.85)+Math.sin(time*2.1+phase+hw.t*2)*.16;
   dx+=hairLag*.019*hw.w*smooth(hw.t);dy+=Math.cos(time*1.1+phase)*.002*hw.w*hw.t;
   const cw=capsule(x,y,p.waist,p.hem,p.clothWidth);
   const hemWeight=cw.w*smooth(cw.t),fold=Math.sin(time*1.23+phase+(x-p.center)*9);
   dx+=(cloth*.020+fold*.005)*hemWeight*Math.sin((x-p.center)*5+1.2);dy+=Math.sin(time*.91+phase+(x-p.center)*7)*.0035*hemWeight;
   for(let side=0;side<2;side++){
    const a=p.arms[side],aw=capsule(x,y,a[0],a[1],.105),lever=smooth(aw.t)*aw.w;
    const idle=Math.sin(time*.85+phase+side*.8)*.0028,sign=side?1:-1;
    const melee=action?.type==='melee',shot=action?.type==='shot';
    dx+=(idle+power*(gesture.prepare*-.004+gesture.hit*(melee?.022:shot?-.010:.006)+gesture.settle*.003))*lever;
    dy+=sign*(idle*.45-power*gesture.prepare*(shot?.002:.007)+power*gesture.hit*.004)*lever;
   }
   // Small secondary motion follows cloth at cuffs and hem; attachment roots stay pinned.
   const accessory=Math.sin(time*1.6+phase-y*4)*.0035;
   dx+=accessory*hemWeight;dy+=Math.cos(time*1.6+phase-y*4)*.002*hemWeight;
   const legs=smooth((y-.57)/.12)*(1-smooth((y-.86)/.10));
   dx+=Math.sin(time*.7+phase+(x-p.center)*8)*.002*legs;
   const shot=action?.type==='shot',melee=action?.type==='melee';
   if(p.muzzle){const weapon=capsule(x,y,p.arms[1][1],p.muzzle,.08);dx-=gesture.hit*power*.007*weapon.w;}
   dx+=power*upper*(gesture.prepare*-.003+gesture.hit*(melee?.018:shot?-.008:.005)+gesture.settle*.002);
   dy+=power*gesture.prepare*.002*torso;
   out[i]=base[i]+dx*foot*gain;out[i+1]=base[i+1]-dy*aspect*foot*gain;
  }
  return out;
 }
 const defaults={center:.5,hairRoot:[.5,.10],hairTip:[.57,.34],hairWidth:.19,waist:[.5,.42],hem:[.51,.69],clothWidth:.25,arms:[[[.35,.25],[.25,.40]],[[.65,.25],[.77,.37]]]};
 const profiles={
  bullet_0:{muzzle:[.86,.168],hairRoot:[.48,.07],hairTip:[.46,.19],hairWidth:.13,waist:[.5,.43],hem:[.5,.66],arms:[[[.37,.25],[.28,.37]],[[.65,.26],[.73,.24]]]},
  bullet_1:{muzzle:[.995,.14],hairRoot:[.40,.09],hairTip:[.08,.36],hairWidth:.16,arms:[[[.36,.27],[.29,.40]],[[.60,.24],[.88,.20]]]},
  bullet_2:{muzzle:[.984,.045],hairRoot:[.52,.055],hairTip:[.16,.42],hairWidth:.22,waist:[.54,.45],hem:[.55,.58],clothWidth:.18,arms:[[[.38,.28],[.31,.43]],[[.66,.26],[.78,.22]]]},
  bullet_3:{muzzle:[.936,.074],hairRoot:[.5,.09],hairTip:[.15,.48],hairWidth:.14,hem:[.52,.47],arms:[[[.35,.26],[.26,.38]],[[.60,.26],[.74,.19]]]},
  poison_0:{hairRoot:[.5,.08],hairTip:[.5,.22],hairWidth:.14},poison_1:{hairTip:[.55,.38],hem:[.55,.60]},poison_2:{hairTip:[.72,.31],hem:[.50,.67]},
  counter_2:{hairTip:[.74,.35]},freeze_0:{hairTip:[.62,.43]},freeze_1:{hairTip:[.5,.21],hairWidth:.14},lifesteal_0:{hairTip:[.5,.45]},lifesteal_2:{hairTip:[.5,.20],hairWidth:.14},bounce_0:{hairTip:[.25,.57]}
 };
 window.ConnectedRig={subdivide,deform,pose,profile:id=>({...defaults,...profiles[id]})};
})();
