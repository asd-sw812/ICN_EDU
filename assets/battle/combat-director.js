/* Read-only presentation adapter. Timings, damage, rolls and rules remain in game. */
(()=>{
 const fields=['id','index','side','hp','maxHp','resource','resourceLabel','resourceMax','energy','shield','enhanced','passiveFlag','evade','preventDeath','counterReady','speed','dead','chill','frozen','freezeGuard','burn','inferno','scorch','bleed','charge','paralyzed'];
 function copy(actor){const result={};for(const key of fields)result[key]=actor[key];result.buffs=Object.fromEntries(Object.entries(actor.buffs||{}).map(([k,v])=>[k,{...v}]));result.poison=[...(actor.poison||[])];result.miasma=[...(actor.miasma||[])];return result}
 function snapshot(battle){return {deck:battle.deckId,currentId:battle.currentId,score:battle.score,over:battle.over,shared:{...battle.shared},boss:copy(battle.boss),players:battle.players.map(copy),logs:battle.logs.slice()}}
 function context(battle,id,tier=0){
  const actor=battle.players.find(a=>a.id===id),ctx=battle.actionContext||{};
  return {actorId:actor?.id,slot:actor?.index||0,tier,effectiveSpeed:actor&&window.effSpeed?window.effSpeed(actor):0,resource:actor?.resource||0,enhanced:actor?.enhanced||0,passiveFlag:!!actor?.passiveFlag,spent:ctx.spent||0,hpSpent:ctx.hpSpent||0,waveTier:battle.deckId==='wave'?(ctx.waveTier||(actor?.energy>=100?4:actor?.energy>=71?3:actor?.energy>=36?2:1)):0,debuffCount:Object.keys(battle.boss.buffs).filter(k=>['atkDown','defDown','speedDown','vulnerable'].includes(k)).length+Number(battle.boss.frozen)+Number(battle.boss.paralyzed),state:snapshot(battle)};
 }
 function begin(actor,meta,api){
  const c=window.ParticleVFX?.config(meta.deck,{...meta.presentation,tier:meta.tier});if(!c)return;
  meta.family=meta.support?'support':c.motion;meta.directed=true;
  window.BattleLive2D?.perform(actor.id,{type:meta.family,windup:meta.windup,total:meta.total,strength:c.size*(1+meta.tier*.16),direction:c.angle,reach:c.speed});
  const enemy=api.target();window.ParticleVFX.begin(meta.support?meta.origin:enemy,meta.deck,meta.tier,meta.windup,{...meta.presentation,origin:meta.origin});
  const fighter=document.querySelector('#activeFighter .fighter-art');
  if(fighter&&!api.reduced&&['melee','dash','brace','draw'].includes(meta.family)){
   const distance=meta.family==='dash'?Math.min(150,(enemy.x-meta.origin.x)*.32):meta.family==='melee'?Math.min(110,(enemy.x-meta.origin.x)*.25):meta.family==='draw'?-12:8;
   const contact=meta.windup/meta.total,tilt=meta.family==='brace'?-1:c.angle*2;
   api.animate(fighter,[{translate:'0px 0px',rotate:'0deg'},{translate:`${-12*c.size}px 2px`,rotate:`${-tilt}deg`,offset:contact*.55},{translate:`${distance*c.speed}px ${meta.family==='dash'?-5:0}px`,rotate:`${tilt}deg`,offset:contact},{translate:'0px 0px',rotate:'0deg',offset:1}],{duration:meta.total,easing:meta.family==='dash'?'cubic-bezier(.1,.8,.2,1)':'ease-in-out',fill:'none'});
  }
 }
 function presentEvents(events,meta,api){
  const hits=events.filter(e=>e.kind==='damage'&&e.amount>0),ordinals=new Map();
  const gap=api.reduced?22:Math.min(75,Math.max(22,((meta?.total||700)-(meta?.windup||0)-180)/Math.max(1,hits.length)));
  let index=0;
  for(const e of events){
   const p=api.point(e.id);if(!p)continue;
   const source=e.sourceId,deck=meta?.deck||e.presentation?.state.deck;
   const replay=deck==='ult'&&!!meta?.actorId&&!!source&&source!==meta.actorId;
   const presentation={...meta?.presentation,...e.presentation,actorId:source||meta?.actorId,origin:source?api.point(source):meta?.origin,tier:replay?2:meta?.boss?(source?0:meta.tier):(meta?.tier||0)};
   if(e.kind==='damage'){
    if(e.side==='enemy'){
     const n=ordinals.get(source)||0;ordinals.set(source,n+1);
     const reactive=!!meta?.boss&&!e.dot&&!!source,before=meta?.before,after=meta?.after;
     // Expiring DOT stacks on a boss turn are not a player-triggered settlement.
     const settlement=!!e.dot&&!!meta&&!meta.boss&&meta.tier>0&&!!before&&!!after&&(deck==='poison'?meta.index===0&&(before.boss.poison.length+before.boss.miasma.length>after.boss.poison.length+after.boss.miasma.length):deck==='bleed'&&[0,2].includes(meta.index)&&before.boss.bleed>after.boss.bleed);
     const executed=deck==='execute'&&n>0&&after?.logs.some(x=>x.startsWith('[처형]'));
     const custom={...presentation,ordinal:n,dot:e.dot,crit:e.crit,reactive,settlement,executed,replay};
     api.later(()=>{
      if(deck==='bullet'&&custom.origin)window.ParticleVFX?.muzzle(custom.origin,deck,custom);
      window.ParticleVFX?.contact(p,deck,presentation.tier,custom);
     },index++*gap+(reactive&&!api.reduced?90:0));
    }else{
     api.later(()=>window.ParticleVFX?.incoming(p,deck,{...presentation,slot:e.index,shield:e.shield,spent:0}),index++*gap);
    }
   }else if(['heal','shield','buff','evade','cleanse'].includes(e.kind)){
    const origin=deck==='lifesteal'?api.target():presentation.origin;
    api.later(()=>window.ParticleVFX?.effect(p,deck,e.kind,{...presentation,origin,amount:e.amount,negative:e.negative}),index*gap);
   }
  }
 }
 function changes(before,after,api){
  if(!before||!after)return;const deck=after.deck,destination=api.support?api.recipient():api.target();
  for(const actor of after.players){
   const old=before.players.find(a=>a.id===actor.id),p=api.point(actor.id);if(!old||!p)continue;
   const custom={actorId:actor.id,slot:actor.index,resource:old.resource,enhanced:actor.enhanced,state:after};
   if(actor.resource<old.resource&&['bullet','hp','electric','skill','counter','defense','follow'].includes(deck))window.ParticleVFX?.transfer(p,destination,deck,{...custom,amount:Math.min(12,old.resource-actor.resource)});
   if(deck==='hp'&&actor.hp<old.hp&&old.id===before.currentId)window.ParticleVFX?.transfer(p,destination,deck,{...custom,amount:6});
   if(actor.energy>old.energy&&deck==='ult')window.ParticleVFX?.effect(p,deck,'energy',custom);
   if(actor.resource>old.resource)window.ParticleVFX?.effect(p,deck,'resource',custom);
   if(!old.enhanced&&actor.enhanced)window.ParticleVFX?.effect(p,'enhance','buff',custom);
  }
  if(before.boss.frozen&&!after.boss.frozen)window.ParticleVFX?.effect(api.target(),'freeze','cleanse',{amount:1});
  if(!before.boss.frozen&&after.boss.frozen)window.ParticleVFX?.effect(api.target(),'freeze','shield');
  if(!before.boss.paralyzed&&after.boss.paralyzed)window.ParticleVFX?.effect(api.target(),'electric','shield');
  if(!before.boss.inferno&&after.boss.inferno)window.ParticleVFX?.effect(api.target(),'burn','buff');
 }
 function sync(state,api){
  if(state.over){window.ParticleVFX?.markers([]);return}
  const list=[],deck=state.deck,b=state.boss,p=api.target(),shared=state.shared;
  const add=(point,texture,size,options={})=>list.push({deck,x:point.x,y:point.y,texture,size,...options});
  const ring=(point,texture,count,radius,size,options={})=>{for(let i=0;i<count;i++){const angle=i/Math.max(1,count)*Math.PI*2;add({x:point.x+Math.cos(angle)*radius,y:point.y+Math.sin(angle)*radius*.8},texture,size,{rotation:angle+Math.PI/2,...options})}};
  if(deck==='poison'){ring(p,'smoke',b.poison.length,47,45,{alpha:.22});ring(p,'wisp',b.miasma.length,68,53,{alpha:.38});}
  if(deck==='freeze'){ring(p,'crystal',b.chill,55,25);if(b.frozen)ring(p,'crystal',8,73,72,{aspect:.15});}
  if(deck==='burn'){ring(p,'ember',b.burn,45,16);if(b.inferno)ring(p,'flame',5,54,50,{alpha:.35});if(b.scorch)add({x:p.x,y:p.y+65},'dust',85,{aspect:.15});}
  if(deck==='bleed')for(let i=0;i<Math.min(12,b.bleed);i++)add({x:p.x-44+i*8,y:p.y+42},'wisp',40,{aspect:.2});
  if(deck==='electric'){ring(p,'arc',b.charge,55,28);if(b.paralyzed)ring(p,'arc',6,72,42);}
  if(deck==='debuff'){const keys=['atkDown','defDown','speedDown','vulnerable'].filter(k=>b.buffs[k]);keys.forEach((k,i)=>add({x:p.x+(i-1.5)*20,y:p.y+52},'spark',80,{rotation:.4+i*.65,aspect:.08}));}
  if(deck==='radiance'){ring(p,'flare',shared.glow,65,14);if(shared.radiance)add({x:p.x,y:p.y},'spark',90+shared.radiance,{rotation:Math.PI/2,aspect:.15,alpha:.1});}
  if(deck==='wind'&&shared.wind){ring(p,'slash',shared.wind>=15?6:3,60,55,{aspect:.25,alpha:.2});}
  for(const actor of state.players){
   if(actor.dead)continue;const q=api.point(actor.id);if(!q)continue;
   if(actor.shield)ring(q,{freeze:'crystal',electric:'arc',tree:'energy',wind:'slash',radiance:'flare'}[deck]||'chip',4,48,24,{alpha:.2});
   if(actor.evade)ring(q,'slash',3,56,45,{aspect:.15,alpha:.15});
   if(actor.preventDeath)add({x:q.x,y:q.y+53},'energy',22,{alpha:.22});
   if(actor.id!==state.currentId)continue;const anchor={x:q.x-65,y:q.y+35};
   if(deck==='tree'){add(anchor,'wisp',65,{aspect:.15});for(let i=0;i<=shared.tree;i++)add({x:anchor.x+(i%2?18:-18),y:anchor.y-i*18},'energy',22,{rotation:i%2?.8:-.8});}
   if(actor.enhanced)ring(q,'energy',8,68,25,{alpha:.22});
   if(actor.resource&&deck!=='tree')ring(anchor,{bullet:'chip',skill:'chip',electric:'arc',poison:'dust',burn:'ember',bleed:'wisp',defense:'chip',counter:'chip',crit:'motes'}[deck]||'energy',Math.min(8,Math.max(1,Math.ceil(actor.resource))),25,14,{alpha:.27});
  }
  window.ParticleVFX?.markers(list);
 }
 window.CombatDirector={begin,presentEvents,changes,sync,snapshot,context};
})();
