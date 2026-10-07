const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/../game','utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(s=>s.trim());
scripts.forEach(s=>new vm.Script(s));
const game=scripts.find(s=>s.includes('const DECKS='));
assert(!html.includes('첫 행동 안내'));
assert(!html.includes('panel.innerHTML=skillOverviewHTML(cur)'));
const ctx=vm.createContext({console,VFX:{event(){},queue(){},busy:false},localStorage:{getItem(){return null}},window:{},document:{body:{classList:{contains(){return true}}}}});
vm.runInContext(game.slice(0,game.indexOf('const VFX =')).replace('}catch(_){return null}', '}catch(error){throw error}'),ctx);
const result=vm.runInContext(`(()=>{
 let previews=0,removed=0;
 for(const d of DECKS){
  selectedDeckId=d.id;
  state=null;
  for(const c of d.party){
   const detail=characterSkillsHTML(c);
   if((detail.match(/<section>/g)||[]).length!==3||!detail.includes('궁극기'))throw Error('Missing character skills '+c.id);
   if(state!==null)throw Error('Formation detail leaked battle state '+c.id);
  }
  const players=d.party.map(makePlayer);
  state={mode:'raid',deckId:d.id,players,boss:makeBoss(),acted:[],currentId:players[0].id,selectedTargetId:players[0].id,logs:[],over:false,paralyzeNeed:5,score:0,playerActions:0,roundsCompleted:0,shared:{radiance:0,glow:0,wind:0,saplingAge:0,tree:0,treeAge:0}};
  for(const p of players){
   state.currentId=p.id;
   if(!p.resourceLabel){
    if(p.resourceLabel||unitResourceHTML(p).includes('stack-readout'))throw Error('Unused resource remains '+p.id);
    resGain(p,10);if(p.resource!==0)throw Error('Unused gain '+p.id);removed++;
   }
   for(const i of [0,1,2]){
    const before=JSON.stringify(state),preview=previewSkillCoefficient(p,i);
    if(!preview)throw Error('Preview failed '+p.id+':'+i);
    if(JSON.stringify(state)!==before)throw Error('Preview mutated battle '+p.id);
    if(preview.changes.some(c=>c.key==='resource'&&!state.players.find(p=>p.id===c.targetId)?.resourceLabel))throw Error('Removed counter changed '+p.id);
    if(!p.resourceLabel&&i===1&&!preview.attackHits&&!preview.heals.length&&!preview.shields.length&&!preview.effects.length&&!preview.changes.length&&!['poison','freeze','burn','bleed','electric'].includes(d.id))throw Error('Empty skill '+p.id);
    const text=skillEffectText(p,i);if(!text||text.includes('불러올 수 없다'))throw Error('Missing skill text '+p.id);
    previews++;
   }
  }
 }
 return {decks:DECKS.length,previews,removed,resourceNames:[...new Set(DECKS.flatMap(d=>d.party.map(p=>p.resourceLabel)).filter(Boolean))]};
})()`,ctx);
assert.equal(result.removed,84);assert.equal(result.previews,288);
assert.deepStrictEqual(Array.from(result.resourceNames),['탄환','저장 피해','기록 피해','전류','축적 피해']);
console.log(JSON.stringify(result));
for(const file of fs.readdirSync(__dirname+'/../assets/battle/rigs').filter(f=>f.endsWith('.json')&&!f.startsWith('boss'))){
 const frame=JSON.parse(fs.readFileSync(__dirname+'/../assets/battle/rigs/'+file)).Frame;
 assert(frame?.length===4 && frame.every(Number.isFinite),file+' missing visible frame');
 assert(frame[0]>=0&&frame[1]>=0&&frame[2]>0&&frame[3]>0&&frame[0]+frame[2]<=1.000001&&frame[1]+frame[3]<=1.000001,file+' invalid visible frame');
}
vm.runInContext(`(()=>{
 showDamagePop=()=>{};
 selectedDeckId='counter';state=null;const d=deck(),players=d.party.map(makePlayer);state={mode:'raid',deckId:'counter',players,boss:makeBoss(),logs:[],shared:{},score:0};
 const source=players[0],boss=state.boss;boss.shield=0;boss.staggered=false;const before=boss.hp;
 takePlayerEffectDamage(boss,100,source,{flat:true});
 if(before-boss.hp!==Math.round(100*deckDamageScale()))throw Error('Flat damage multiplied by attack or minimum damage');
})()`,ctx);
console.log('Visible frames and flat effect damage passed');
