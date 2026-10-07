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
  const hit=after>=0?Math.exp(-after*5.5)*Math.sin(Math.min(1,after/.07)*Math.PI*.5):0;
  // Slower recovery, tapered to zero inside the existing action window.
  const finish=1-smooth((elapsed-(d-.18))/.18);
  return {prepare:prepare*finish,hit:hit*finish,settle:after>=0?Math.sin(after*9)*Math.exp(-after*3)*finish:0};
 }
 function deform(base,out,aspect,profile,time,phase,action,gain=1){
  const p=profile,gesture=pose(time,action),power=action?.strength||1;
  const idleTime=time*.65; // Longer outward/return cycle without slowing attack timing.
  const breath=Math.sin(idleTime*1.45+phase),cloth=Math.sin(idleTime*.91+phase-1);
  for(let i=0;i<base.length;i+=2){
   const x=base[i]+.5,y=.5-base[i+1]/aspect;
   const upper=smooth((.9-y)/.65),foot=smooth((.985-y)/.07);
   const torso=smooth(1-Math.abs(x-p.center)/.28)*smooth(1-Math.abs(y-.43)/.3);
   // Broad, slow weight shift stays anchored at the feet; tips lag behind the torso.
   const sway=Math.sin(idleTime*.82+phase);
   let dx=sway*.014*upper+(x-p.center)*breath*.012*torso,dy=breath*.003*torso;
   const hw=capsule(x,y,p.hairRoot,p.hairTip,p.hairWidth);
   const hairLag=Math.sin(idleTime*1.2+phase+.7-hw.t*.85)+Math.sin(idleTime*2.1+phase+hw.t*2)*.16;
   dx+=hairLag*.054*hw.w*smooth(hw.t);dy+=Math.cos(idleTime*1.1+phase)*.006*hw.w*hw.t;
   const cw=capsule(x,y,p.waist,p.hem,p.clothWidth);
   const hemWeight=cw.w*smooth(cw.t),fold=Math.sin(idleTime*1.23+phase+(x-p.center)*9);
   dx+=(cloth*.051+fold*.012)*hemWeight*Math.sin((x-p.center)*5+1.2);dy+=Math.sin(idleTime*.91+phase+(x-p.center)*7)*.0088*hemWeight;
   for(let side=0;side<2;side++){
    const a=p.arms[side],aw=capsule(x,y,a[0],a[1],.105),lever=smooth(aw.t)*aw.w;
    const idle=Math.sin(idleTime*.85+phase+side*.8)*.0074,sign=side?1:-1;
    const melee=action?.type==='melee',shot=action?.type==='shot';
    dx+=(idle+power*(gesture.prepare*-.004+gesture.hit*(melee?.022:shot?-.010:.006)+gesture.settle*.003))*lever;
    dy+=sign*(idle*.45-power*gesture.prepare*(shot?.002:.007)+power*gesture.hit*.004)*lever;
   }
   // Small secondary motion follows cloth at cuffs and hem; attachment roots stay pinned.
   const accessory=Math.sin(idleTime*1.6+phase-y*4)*.0095;
   dx+=accessory*hemWeight;dy+=Math.cos(idleTime*1.6+phase-y*4)*.0054*hemWeight;
   const legs=smooth((y-.57)/.12)*(1-smooth((y-.86)/.10));
   dx+=Math.sin(idleTime*.7+phase+(x-p.center)*8)*.0047*legs;
   const shot=action?.type==='shot',melee=action?.type==='melee';
   const dash=action?.type==='dash',brace=action?.type==='brace',draw=action?.type==='draw';
   const reach=action?.reach||1,direction=action?.direction||0;
   if(action?.type==='support'){dy-=power*gesture.prepare*.015*upper;dx+=power*gesture.settle*.005*torso}
   if(action?.type==='hurt'){dx-=power*gesture.hit*.026*upper;dy+=power*gesture.hit*.008*torso}
   if(action?.tier===2){dx+=power*gesture.hit*.018*upper;dy-=power*gesture.prepare*.009*torso}
   dx+=power*upper*(dash?gesture.hit*.012*reach:brace?-gesture.prepare*.004:draw?-gesture.hit*.004:0);
   dy+=power*torso*(brace?gesture.prepare*.004:draw?-gesture.prepare*.002:0);
   dx+=power*gesture.hit*direction*.002*torso;
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
 // Boss weights follow their actual silhouettes, with continuous shared vertices.
 function deformBoss(base,out,aspect,p,time,phase,action,gain=1){
  const t=time*.65,g=pose(time,action),power=action?.strength||1,hurt=action?.type==='hurt';
  const strike=hurt?0:g.hit*power,prepare=hurt?0:g.prepare*power;
  for(let i=0;i<base.length;i+=2){
   const x=base[i]+.5,y=.5-base[i+1]/aspect,upper=smooth((.98-y)/.8);
   const region=(cx,cy,rx,ry)=>smooth(1-Math.hypot((x-cx)/rx,(y-cy)/ry));
   const torso=region(p.center,.43,.31,.4),breath=Math.sin(t*1.1+phase);
   let dx=Math.sin(t*.75+phase)*.014*upper,dy=breath*.007*torso;
   if(p.kind==='warden'){
    dx+=(x-p.center)*breath*.018*torso;
    for(let s=0;s<2;s++){const a=p.arms[s],w=capsule(x,y,a[0],a[1],.14);dx+=(Math.sin(t*.9+phase+s*.8-w.t)*.032+strike*-.055)*w.w*smooth(w.t);dy+=Math.sin(t*.9+phase+s)*.01*w.w*w.t;}
    const head=region(.46,.09,.16,.17);dx+=Math.sin(t*.62+phase)*.012*head;
    const chain=region(.5,.40,.32,.13);dy+=Math.sin(t*1.6+phase+x*6)*.009*chain;
   }else if(p.kind==='devourer'){
    const maw=region(.54,.26,.3,.35),pulse=Math.sin(t*1.35+phase);
    dx+=(x-.54)*(pulse*.045+prepare*-.08+strike*.16)*maw;
    dy+=(y-.26)*(pulse*.028+strike*.08)*maw;
    for(let s=0;s<2;s++){const a=p.arms[s],w=capsule(x,y,a[0],a[1],.18);dx+=(Math.sin(t*1.15+phase+s*2)*.029-strike*.045)*w.w*smooth(w.t);dy+=(Math.cos(t*.95+phase+s)*.014-prepare*.012)*w.w*w.t;}
    dy+=Math.sin(t*.8+phase)*.008*upper;
   }else{
    // Observer floats freely; hanging ribbons lag behind the head and plates.
    dy+=Math.sin(t*.85+phase)*.018;
    const head=region(.52,.17,.18,.22);dx+=Math.sin(t*.72+phase)*.025*head;
    for(const [j,a] of p.plates.entries()){const w=region(a[0],a[1],.14,.12);dx+=Math.sin(t*1.25+phase+j)*.024*w;dy+=Math.cos(t*1.1+phase+j*.9)*.018*w;}
    const ribbons=smooth((y-.39)/.2)*smooth(1-Math.abs(x-.52)/.25);dx+=Math.sin(t*1.25+phase-y*5)*.042*ribbons;dy+=Math.cos(t*.95+phase-y*3)*.009*ribbons;
   }
   dx+=(-prepare*.012-strike*.047+g.settle*.009)*upper;
   if(hurt){dx+=Math.sin((time-action.start)*24)*g.hit*.034*upper;dy-=g.hit*.012*torso;}
   const pin=p.kind==='observer'?1:smooth((.99-y)/.10);
   out[i]=base[i]+dx*pin*gain;out[i+1]=base[i+1]-dy*aspect*pin*gain;
  }return out;
 }
 window.ConnectedRig={subdivide,deform,deformBoss,pose,profile:id=>({...defaults,...profiles[id]})};
})();
