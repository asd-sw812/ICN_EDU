/* Presentation bridge only; game owns damage and timing. */
(()=>{
 const families={bullet:'shot',counter:'melee',follow:'melee',speed:'melee',execute:'melee',crit:'melee',bleed:'melee'};
 function begin(actor,meta,api){
  const family=meta.support?'support':families[meta.deck]||'cast';meta.family=family;meta.directed=true;
  window.BattleLive2D?.perform(actor.id,{type:family,windup:meta.windup,total:meta.total,strength:1+meta.tier*.22});
  const fighter=document.querySelector('#activeFighter .fighter-art'),enemy=api.target();
  window.ParticleVFX?.begin(meta.support?meta.origin:enemy,meta.deck,meta.tier,meta.windup);
  if(family==='melee'&&fighter&&!api.reduced){
   const distance=Math.max(0,Math.min(260,(enemy.x-meta.origin.x)*.55)),contact=meta.windup/meta.total;
   api.animate(fighter,[{transform:'translateX(0px)'},{transform:'translateX(-14px)',offset:contact*.35},{transform:'translateX('+distance+'px)',offset:contact},{transform:'translateX('+(distance-8)+'px)',offset:Math.min(.8,contact+.13)},{transform:'translateX(0px)',offset:1}],{duration:meta.total,easing:'cubic-bezier(.3,.05,.25,1)',fill:'none'});
  }
  if(family==='shot')api.later(()=>{
   const a=window.BattleLive2D?.anchor(actor.id,'muzzle'),b=api.bounds();
   window.ParticleVFX?.muzzle(a?{x:(a.x-b.left)/b.sx,y:(a.y-b.top)/b.sy}:meta.origin,meta.deck);
  },meta.windup-45);
 }
 function impact(p,meta){window.ParticleVFX?.hit(p,meta.deck,meta.tier)}
 function support(p,meta){window.ParticleVFX?.support(p,meta.deck,meta.tier)}
 window.CombatDirector={begin,impact,support,families};
})();
