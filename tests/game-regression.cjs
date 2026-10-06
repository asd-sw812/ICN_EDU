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

