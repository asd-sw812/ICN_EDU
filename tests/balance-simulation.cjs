const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(process.argv[2]||__dirname+'/../game','utf8');
const source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const DECKS='));
const queue=[];let seed=1;const math=Object.create(Math);math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const ctx=vm.createContext({console,Math:math,VFX:{resolving:true,busy:false,event(){},queue(fn){queue.push(fn)},castBoss(fn){fn()}},localStorage:{getItem(){return null},setItem(){}},window:{},document:{body:{classList:{contains(){return true}}}}});
vm.runInContext(source.slice(0,source.indexOf('const VFX =')),ctx);
vm.runInContext(`showDamagePop=()=>{};render=()=>{};showResult=()=>{};requestMobileLandscape=()=>{};raidResult=()=>{state.over=true};`,ctx);
const rows=[];
for(const mode of ['raid','clear'])for(let boss=0;boss<3;boss++)for(let d=0;d<24;d++)for(let trial=0;trial<8;trial++){
 seed=1031+trial*7919;queue.length=0;
 vm.runInContext(`selectedDeckId=DECKS[${d}].id;selectedBossId=BOSSES[${boss}].id;selectedMode='${mode}';state={mode:selectedMode,deckId:selectedDeckId,players:deck().party.map(makePlayer),boss:makeBoss(),currentId:null,selectedTargetId:deck().party[0].id,logs:[],over:false,intent:null,paralyzeNeed:5,score:0,playerActions:0,actionsCompleted:0,avTime:0,nextDotAV:DOT_AV_INTERVAL,shared:{radiance:0,glow:0,wind:0,saplingAge:0,tree:0,treeAge:0}};state.intent=bossIntent();nextTurn();`,ctx);
 let steps=0;
 while(!vm.runInContext('state.over||state.avTime>=1500',ctx)&&steps++<600){
  if(queue.length){queue.shift()();continue}
  vm.runInContext(`(()=>{const a=current();if(!a||a.side!=='player')throw Error('stalled turn');const low=lowestPlayer(),guard=tank();state.selectedTargetId=low&&low.hp/low.maxHp<.65?low.id:main().dead?a.id:main().id;let which=a.energy>=ultEnergyRequirement(a)?2:a.sp>=2?1:0;if(state.deckId==='bullet'&&a.index===0&&a.resource<4)which=0;if(isSupportAction(state.deckId,a.index,which)&&a.index===3)state.selectedTargetId=guard?.id||a.id;useSkill(which);})()`,ctx);
 }
 rows.push({...vm.runInContext(`({deck:state.deckId,boss:state.boss.bossId,mode:state.mode,score:state.score,actions:state.playerActions,av:state.avTime,alive:alivePlayers().length,won:state.boss.dead,hp:alivePlayers().reduce((n,p)=>n+p.hp,0)})`,ctx),trial});
}
const groups=[];for(const mode of ['raid','clear'])for(const deck of [...new Set(rows.map(r=>r.deck))]){const rs=rows.filter(r=>r.mode===mode&&r.deck===deck),mean=k=>Math.round(rs.reduce((n,r)=>n+Number(r[k]),0)/rs.length);groups.push({mode,deck,score:mean('score'),actions:mean('actions'),av:mean('av'),alive:mean('alive'),wins:rs.filter(r=>r.won).length,runs:rs.length})}
if(rows.length!==1152||rows.some(r=>!Number.isFinite(r.score)||!Number.isFinite(r.hp)||r.hp<0||r.actions>=600))throw Error('Invalid simulation result');
fs.writeFileSync(process.argv[3]||__dirname+'/balance-results.json',JSON.stringify({policy:'8 deterministic seeds, 3 bosses, no stat investment; ultimate then skill2 then skill1, support lowest HP/main; tank self shields',rows,groups},null,2));console.table(groups.filter(r=>r.mode==='raid').sort((a,b)=>b.score-a.score));console.table(groups.filter(r=>r.mode==='clear').sort((a,b)=>b.wins-a.wins||a.actions-b.actions));

