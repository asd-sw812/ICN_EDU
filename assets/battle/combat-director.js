/* Battle choreography: anticipation -> character gesture -> contact -> recovery. */
(()=>{
 const families={bullet:'shot',counter:'melee',follow:'melee',speed:'melee',execute:'melee',crit:'melee',bleed:'melee',poison:'mist',freeze:'ice',burn:'fire',electric:'lightning',wave:'wave',tree:'vines',wind:'vortex',radiance:'light',lifesteal:'drain',bounce:'cards',debuff:'seal',skill:'ink',ult:'sound',hp:'thread',cleanse:'bloom',enhance:'gears',defense:'wall'};
 const NS='http://www.w3.org/2000/svg';
 function node(tag,attrs={}){const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n}
 function layer(api,p,color,markup,frames,duration=600,scale=1){
  const root=document.getElementById('vfxCanvas');if(!root)return;
  const wrap=node('g',{transform:`translate(${p.x} ${p.y}) scale(${scale})`}),inner=node('g');inner.innerHTML=markup;inner.style.color=color;wrap.append(inner);root.append(wrap);
  api.animate(inner,frames,{duration,easing:'cubic-bezier(.2,.75,.3,1)',fill:'forwards'});api.later(()=>wrap.remove(),duration+50);return wrap;
 }
 const expand=[{opacity:0,transform:'scale(.2)'},{opacity:1,transform:'scale(.95)',offset:.2},{opacity:.7,transform:'scale(1.06)',offset:.65},{opacity:0,transform:'scale(1.2)'}];
 function ground(api,p,color,tier){
  return layer(api,{x:p.x,y:p.y+85},color,'<ellipse rx="110" ry="25" fill="currentColor" opacity=".2"/><ellipse rx="110" ry="25" fill="none" stroke="currentColor" stroke-width="3"/>',expand,600,1+tier*.3);
 }
 function debris(api,p,color,tier,kind='chip'){
  const count=api.reduced?4:9+tier*4;
  for(let i=0;i<count;i++){
   const angle=(i/count)*Math.PI*2,dist=65+(i%4)*24+tier*20;
   const markup=kind==='smoke'?'<circle r="18" fill="currentColor" opacity=".18"/>':kind==='leaf'?'<path d="M-8 0Q0-17 13-3Q8 13-8 0Z" fill="currentColor"/>':kind==='casing'?'<rect x="-6" y="-2" width="12" height="4" rx="1" fill="#c7a168" stroke="#ffe9b6"/>':'<path d="M-5-8L7-3L4 8L-5 4Z" fill="currentColor"/>';
   layer(api,p,color,markup,[{opacity:1,transform:'translate(0px,0px) rotate(0deg)'},{opacity:.8,transform:`translate(${Math.cos(angle)*dist*.65}px,${Math.sin(angle)*dist*.65-15}px) rotate(${i*50}deg)`,offset:.45},{opacity:0,transform:`translate(${Math.cos(angle)*dist}px,${Math.sin(angle)*dist+35}px) rotate(${i*100}deg) scale(.5)`}],420+(i%4)*90);
  }
 }
 function cut(api,p,color,tier,angle=-28){
  const markup=`<g transform="rotate(${angle})"><path d="M-140 60Q-20-110 145-52Q20-42-140 60Z" fill="currentColor"/><path d="M-127 52Q-15-74 138-51" fill="none" stroke="#fff8e5" stroke-width="5"/></g>`;
  layer(api,p,color,markup,[{opacity:0,transform:'scale(.25,1)'},{opacity:1,transform:'scale(1,1)',offset:.18},{opacity:0,transform:'scale(1.18,.55)'}],360,1+tier*.25);
 }
 function begin(actor,meta,api){
  const family=meta.support?'support':families[meta.deck]||'ink';meta.family=family;meta.directed=true;
  const type=family==='shot'?'shot':family==='melee'?'melee':meta.support?'support':'cast';
  window.BattleLive2D?.perform(actor.id,{type,windup:meta.windup,total:meta.total,strength:1+meta.tier*.22});
  const fighter=document.querySelector('#activeFighter .fighter-art'),enemy=api.target();
  if(family==='melee'&&fighter&&!api.reduced){
   const distance=Math.max(0,Math.min(260,(enemy.x-meta.origin.x)*.55)),contact=meta.windup/meta.total;
   api.animate(fighter,[{transform:'translateX(0px)'},{transform:'translateX(-14px)',offset:contact*.35},{transform:`translateX(${distance}px)`,offset:contact},{transform:`translateX(${distance-8}px)`,offset:Math.min(.8,contact+.13)},{transform:'translateX(0px)',offset:1}],{duration:meta.total,easing:'cubic-bezier(.3,.05,.25,1)',fill:'none'});
  }
  if(family==='shot'){
   api.later(()=>{
    const a=window.BattleLive2D?.anchor(actor.id,'muzzle'),b=api.bounds(),p=a?{x:(a.x-b.left)/b.sx,y:(a.y-b.top)/b.sy}:meta.origin;
    const angle=Math.atan2(enemy.y-p.y,enemy.x-p.x)*180/Math.PI;
    layer(api,p,api.color,`<g transform="rotate(${angle})"><path d="M0 0L45-15L29-4L65 0L29 4L45 15Z" fill="#ffe4a4"/><path d="M0 0L35-5L27 0L35 5Z" fill="#fff"/></g>`,[{opacity:1},{opacity:0}],140,1+meta.tier*.3);
    // A gunshot is contact + recoil; no slow bullet object travelling across the arena.
    debris(api,p,api.color,0,'casing');
    layer(api,p,'#d5cec1','<ellipse rx="13" ry="8" fill="currentColor" opacity=".35"/>',[{opacity:.6,transform:'translate(12px,0px) scale(.5)'},{opacity:0,transform:'translate(35px,-25px) scale(2.3)'}],500);
   },meta.windup-45);
  }else if(family!=='melee'){
   const cue=meta.support?meta.origin:enemy;
   ground(api,cue,api.color,meta.tier);
   if(!api.reduced)layer(api,cue,api.color,'<ellipse rx="105" ry="21" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="12 9"/>',[{opacity:0,transform:'translateY(85px) scale(.5)'},{opacity:.55,transform:'translateY(85px) scale(1.1)'}],meta.windup);
  }
 }
 function impact(p,meta,api){
  const family=(meta.family==='support'?families[meta.deck]:meta.family)||families[meta.deck]||'ink',tier=meta.tier||0,color=api.color,s=1+tier*.3;
  const make=(markup,frames=expand,duration=650,point=p)=>layer(api,point,color,markup,frames,duration,s);
  if(family==='shot'){
   const n=tier===2?4:tier===1?3:1;
   for(let i=0;i<n;i++)api.later(()=>{const q={x:p.x+(i%2?22:-15),y:p.y+i*15-20};layer(api,q,color,'<path d="M0-32L5-6L34 0L6 5L0 30L-5 6L-30 0L-5-5Z" fill="#fff4ca"/><circle r="17" fill="none" stroke="currentColor" stroke-width="4"/>',expand,300,s);debris(api,q,color,0)},i*75);
  }else if(family==='melee'){
   const heavy=meta.deck==='execute'||meta.deck==='counter';cut(api,p,color,tier,heavy?-65:-25);
   if(tier||meta.deck==='follow')api.later(()=>cut(api,{x:p.x+10,y:p.y+15},color,tier,35),110);
   if(heavy)ground(api,p,color,tier);debris(api,p,color,tier);
  }else if(family==='ice'){
   for(let i=0;i<5+tier;i++)api.later(()=>make('<path d="M-26 90L-14-90L0-150L27-23L20 90Z" fill="#84c8e0" stroke="#e7fbff" stroke-width="2"/><path d="M0-150L7 80M-14-90L7-2L27-23" fill="none" stroke="#e7fbff" stroke-width="2"/>',[{opacity:0,transform:'translateY(90px) scaleY(0)'},{opacity:1,transform:'translateY(0px) scaleY(1)',offset:.27},{opacity:.85,offset:.65},{opacity:0,transform:'translateY(12px) scaleY(.95)'}],700,{x:p.x+(i-2)*39,y:p.y+(i%2)*15}),i*45);
   debris(api,p,'#c4f4ff',tier);
  }else if(family==='lightning'){
   for(let i=0;i<3+tier;i++)api.later(()=>make('<path d="M-42-260L2-165L-28-104L24-49L0 35" fill="none" stroke="currentColor" stroke-width="16" opacity=".35"/><path d="M-42-260L2-165L-28-104L24-49L0 35" fill="none" stroke="#ffffe4" stroke-width="5"/>',[{opacity:0},{opacity:1,offset:.08},{opacity:.2,offset:.3},{opacity:1,offset:.4},{opacity:0}],310,{x:p.x+(i-1)*45,y:p.y}),i*70);ground(api,p,color,tier);
  }else if(family==='fire'){
   for(let i=0;i<5;i++)api.later(()=>make('<path d="M-35 85Q-83-35-25-75Q-32-10-5-155Q67-80 20-20Q60-25 37 85Z" fill="#e65c2e"/><path d="M-18 83Q-35 10 0-59Q0 25 22 6Q35 45 14 83Z" fill="#ffdfa0"/>',[{opacity:0,transform:'translateY(60px) scale(.5,.1)'},{opacity:1,transform:'translateY(0px) scale(1)',offset:.25},{opacity:0,transform:'translateY(-75px) scale(.8,1.2)'}],650,{x:p.x+(i-2)*36,y:p.y+(i%2)*20}),i*65);debris(api,p,'#ffb66b',tier,'smoke');
  }else if(family==='wave'){
   make('<path d="M-180 90Q-100-90-12-75Q98-73 63 9Q37 45 4 5Q54 10 26-23Q-37-42-90 90Z" fill="#3c8bb9"/><path d="M-180 90Q-100-90-12-75Q98-73 63 9Q37 45 4 5" fill="none" stroke="#d8f5ee" stroke-width="12"/><path d="M-160 85Q-54 16 120 81" fill="none" stroke="#9cdee7" stroke-width="15"/>',[{opacity:0,transform:'translateX(-90px) scale(.5)'},{opacity:1,transform:'translateX(0px) scale(1)',offset:.35},{opacity:0,transform:'translateX(80px) scale(1.15)'}],850);debris(api,p,'#ade6ef',tier);
  }else if(family==='vines'){
   for(let i=0;i<4+tier;i++)api.later(()=>make(`<path d="M${(i-2)*45} 110Q-110 25 15-15T20-120" fill="none" stroke="#568861" stroke-width="15"/><path d="M-35 15Q-99-29-52-30Q-16-30-35 15M22-44Q74-100 74-53Q62-19 22-44" fill="#b3d595"/>`,[{opacity:0,transform:'translateY(80px) scaleY(.05)'},{opacity:1,transform:'translateY(0px) scaleY(1)',offset:.4},{opacity:0,transform:'scale(1.05)'}],850),i*80);debris(api,p,'#b4d296',tier,'leaf');
  }else if(family==='vortex'){
   for(let i=0;i<4+tier;i++)api.later(()=>make('<path d="M-120 40Q-80-110 122-35Q48-82-83 44Q-25 105 120 18Q25 130-120 40Z" fill="currentColor" opacity=".75"/>',[{opacity:0,transform:'scale(.2) rotate(-40deg)'},{opacity:1,transform:'scale(1) rotate(0deg)',offset:.3},{opacity:0,transform:'scale(1.1) rotate(80deg)'}],580,{x:p.x,y:p.y+25-i*22}),i*70);
  }else if(family==='mist'||family==='drain'){
   ground(api,p,color,tier);for(let i=0;i<9;i++){const x=(i%3-1)*65,y=Math.floor(i/3)*25;api.later(()=>make('<circle r="52" fill="currentColor" opacity=".19"/><circle cy="12" r="28" fill="currentColor" opacity=".15"/>',[{opacity:0,transform:'translateY(90px) scale(.2)'},{opacity:1,transform:'translateY(0px) scale(1)',offset:.4},{opacity:0,transform:'translateY(-100px) scale(1.3)'}],900,{x:p.x+x,y:p.y+y}),i*45)}
   if(family==='drain')make('<path d="M-60 90Q-120-80 0-90T60 90M-45 90Q-70-50 0-65T45 90" fill="none" stroke="currentColor" stroke-width="6"/>');
  }else if(family==='light'){
   make('<path d="M-35-300H35L75 100H-75Z" fill="currentColor" opacity=".22"/><path d="M-4-300H4V100H-4Z" fill="#fff8cf"/><ellipse cy="95" rx="110" ry="30" fill="none" stroke="#fff6d2" stroke-width="4"/>',[{opacity:0,transform:'scaleX(.05)'},{opacity:1,transform:'scaleX(1)',offset:.2},{opacity:0,transform:'scaleX(1.4)'}],780);debris(api,p,color,tier);
  }else if(family==='cards'||family==='seal'){
   for(let i=0;i<6+tier;i++){
    const a=i/6*Math.PI*2,q={x:p.x+Math.cos(a)*90,y:p.y+Math.sin(a)*85};
    layer(api,q,color,'<rect x="-16" y="-28" width="32" height="56" rx="2" fill="#f2e9cf" stroke="currentColor" stroke-width="2"/><path d="M0-18L9 0L0 18L-9 0Z" fill="currentColor"/>',[{opacity:0,transform:`rotate(${i*40}deg) scale(.2)`},{opacity:1,transform:`rotate(${i*40}deg) scale(1)`,offset:.22},{opacity:1,transform:`translate(${(p.x-q.x)*.7}px,${(p.y-q.y)*.7}px) rotate(${i*40+90}deg)`,offset:.65},{opacity:0,transform:'scale(.1)'}],720);
   }api.later(()=>cut(api,p,color,tier,45),420);
  }else if(family==='sound'){
   for(let i=0;i<4+tier;i++)api.later(()=>make('<ellipse rx="85" ry="110" fill="none" stroke="currentColor" stroke-width="7"/><path d="M-130 0H-90M90 0H130" stroke="#ffefd0" stroke-width="3"/>',expand,650),i*100);
  }else if(family==='wall'){
   make('<path d="M-110 95V-100H-38V-155H38V-100H110V95Z" fill="#59626f" stroke="#d4c6a5" stroke-width="4"/><path d="M-110-20H110M-38-100V95M38-100V95" stroke="#c7b28d" stroke-width="2"/>',[{opacity:0,transform:'translateY(130px) scaleY(.1)'},{opacity:1,transform:'translateY(0px) scaleY(1)',offset:.3},{opacity:0,transform:'translateY(10px) scale(1.05)'}],750);debris(api,p,color,tier);
  }else{
   // Ink/thread/bloom/gear attacks form at contact rather than launching a generic token.
   const art=family==='thread'?'<path d="M-120 100Q100-100 60-120M-80 110Q130 10-80-80M-110-40Q0 70 110-20" fill="none" stroke="currentColor" stroke-width="5"/>':family==='bloom'?'<path d="M0 70Q-140 20-40-70Q-10-150 40-70Q140 10 0 70Z" fill="currentColor" opacity=".65"/>':family==='gears'?'<circle r="85" fill="none" stroke="currentColor" stroke-width="18" stroke-dasharray="18 13"/><circle r="47" fill="none" stroke="#fff0c4" stroke-width="4"/>':'<path d="M-105 75Q-78-45 90-100L35-28L115 10L-12 27L-55 100Z" fill="currentColor" opacity=".9"/>';
   make(art);debris(api,p,color,tier,family==='bloom'?'leaf':'chip');
  }
  const figure=document.querySelector('.boss-figure');
  if(figure&&!api.reduced)api.animate(figure,[{translate:'0px 0px',filter:'brightness(1)'},{translate:'9px -3px',filter:'brightness(1.7)',offset:.12},{translate:'9px -3px',filter:'brightness(1.3)',offset:.27},{translate:'-3px 1px',filter:'brightness(1)',offset:.55},{translate:'0px 0px',filter:'brightness(1)'}],{duration:320,fill:'none'});
 }
 function support(p,meta,api){
  ground(api,p,'#b9dcc3',meta.tier);
  layer(api,p,api.color,'<ellipse rx="65" ry="100" fill="none" stroke="currentColor" stroke-width="3"/><path d="M-48 35V-30M-15 0V-65M20 20V-45M50 50V-15" stroke="#e1f7d7" stroke-width="3"/>',[{opacity:0,transform:'translateY(40px) scale(.5)'},{opacity:.85,transform:'translateY(0px) scale(1)',offset:.3},{opacity:0,transform:'translateY(-45px) scale(1.1)'}],750);
 }
 window.CombatDirector={begin,impact,support,families};
})();
