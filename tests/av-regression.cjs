const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(process.argv[2]||__dirname+'/../game','utf8');
const source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('const DECKS='));
const queue=[],records=new Map(),elements=new Map();let confirmResult=true,seed=123;
const math=Object.create(Math);math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const node=id=>{if(!elements.has(id))elements.set(id,{disabled:false,innerHTML:'',classList:{add(){},remove(){}}});return elements.get(id)};
const ctx=vm.createContext({console,Math:math,VFX:{resolving:true,busy:false,event(){},queue(fn){queue.push(fn)},reset(){queue.length=0},castBoss(fn){fn()}},localStorage:{getItem(k){return records.get(k)||null},setItem(k,v){records.set(k,v)}},window:{confirm(){return confirmResult}},document:{getElementById:node,body:{classList:{contains(){return true}}}}});
vm.runInContext(source.slice(0,source.indexOf('const VFX =')),ctx);
vm.runInContext(`showDamagePop=()=>{};render=()=>{};showResult=(title,text)=>{state.lastResult={title,text}};
function testBegin(id='tree',mode='raid'){
 selectedDeckId=id;selectedBossId=BOSSES[0].id;selectedMode=mode;
 const players=deck().party.map(makePlayer);
 state={mode,deckId:id,players,boss:makeBoss(),currentId:null,selectedTargetId:players[0].id,logs:[],over:false,intent:null,paralyzeNeed:5,score:0,playerActions:0,actionsCompleted:0,avTime:0,nextDotAV:DOT_AV_INTERVAL,recorded:false,shared:{radiance:0,glow:0,wind:0,saplingAge:0,tree:0,treeAge:0}};state.intent=bossIntent();
}
function clockFixture(){testBegin('bullet');state.boss.dead=true;state.players.slice(2).forEach(p=>p.dead=true);for(const p of state.players){p.speed=100;p.buffs={};p.actionGauge=ACTION_GAUGE}}
`,ctx);
const run=s=>vm.runInContext(s,ctx),near=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
run(`clockFixture();state.players[1].speed=200;nextTurn()`);near(run('state.avTime'),50);assert.equal(run('current().id'),run('state.players[1].id'));
const order=[];
while(!run('state.over')){order.push(run('current().id'));run('completeCombatTurn(current())');queue.length=0;run('nextTurn()')}
near(run('state.avTime'),350);assert.equal(order.filter(x=>x==='bullet_1').length,6);assert.equal(order.filter(x=>x==='bullet_0').length,3);
run(`clockFixture();state.players[1].dead=true;state.players[0].actionGauge=5000;state.players[0].buffs.speedUp={v:100,d:10,stacks:1};nextTurn()`);near(run('state.avTime'),40);queue.length=0;
run(`clockFixture();state.players[1].actionGauge=5000;state.currentId=state.players[0].id;advanceAction(state.players[1],20)`);near(run('actionAV(state.players[1])'),30);queue.length=0;
run(`clockFixture();state.currentId=state.players[0].id;advanceAction(state.players[0],35);completeCombatTurn(state.players[0])`);near(run('state.players[0].actionGauge'),6500);queue.length=0;
run(`testBegin('tree');advanceCombatAV(60)`);assert.equal(run('state.shared.tree'),1);
run('advanceCombatAV(60)');assert.equal(run('state.shared.tree'),2);
run('advanceCombatAV(60)');assert.equal(run('state.shared.tree'),3);queue.length=0;
run(`testBegin('skill');const target=state.players[0];state.currentId=state.players[1].id;addBuff(target,'atkUp',10,2);advanceCombatAV(10)`);near(run('state.players[0].buffs.atkUp.d'),150);
run(`setEnhanced(state.players[0],2);advanceCombatAV(10)`);near(run('state.players[0].enhanced'),150);
run(`addBuff(state.players[0],'defUp',4,99);const copied=clone(state);if(copied.players[0].buffs.defUp.d!==Infinity)throw Error('Infinite duration lost in preview copy');`);
const before=run('JSON.stringify(state)');run('previewSkillCoefficient(state.players[0],1)');assert.equal(run('JSON.stringify(state)'),before);queue.length=0;
run(`testBegin('poison');addPoison(3);advanceCombatAV(24)`);assert.equal(run('state.score'),0);
run('advanceCombatAV(1)');assert(run('state.score')>0);near(run('state.boss.poison[0]'),155);
const dotScore=run('state.score');run('advanceCombatAV(0)');assert.equal(run('state.score'),dotScore);queue.length=0;
run(`testBegin('bullet','clear');nextTurn();state.boss.hp=1;useSkill(0)`);assert.equal(run('state.over'),true);assert.equal(run('state.actionsCompleted'),1);near(run('getClearRecord(state.boss.bossId).av'),run('state.avTime'));queue.length=0;
run(`testBegin('poison','clear');state.boss.hp=1;addPoison(3);nextTurn()`);assert.equal(run('state.over'),true);near(run('state.avTime'),25);assert.equal(run('state.actionsCompleted'),0);queue.length=0;
run(`testBegin('bullet');nextTurn();completeCombatTurn(current())`);queue.length=0;run(`state.boss.frozen=true;while(current().side!=='enemy'&&!state.over){nextTurn();if(current().side==='player')completeCombatTurn(current())}if(current().side==='enemy'){const old=state.actionsCompleted;resolveBossTurn();if(state.actionsCompleted!==old+1)throw Error('Skipped boss action count')}`);queue.length=0;
for(const id of run('DECKS.map(d=>d.id)')){
 run(`testBegin('${id}');nextTurn()`);let steps=0;
 while(!run('state.over')&&steps++<300){if(queue.length){queue.shift()();continue}run(`(()=>{const a=current();if(a.side!=='player')throw Error('stalled');useSkill(a.energy>=ultEnergyRequirement(a)?2:a.sp>=2?1:0)})()`)}
 assert(run('state.over'),id+' did not finish');near(run('state.avTime'),350);assert(run('state.actionsCompleted>0&&state.actionsCompleted<60'),id+' excessive actions');assert(Number.isFinite(run('state.score')));
 const av=run('state.avTime');run('nextTurn()');near(run('state.avTime'),av);queue.length=0;
}
run(`testBegin('tree');state.avTime=100;state.score=12345;`);confirmResult=false;run('settleBattle()');assert.equal(run('state.over'),false);
confirmResult=true;run('settleBattle()');assert.equal(run('state.over'),true);near(run('state.avTime'),100);assert(records.has(run('RAID_RECORD_KEY')));
const clearBefore=records.get(run('CLEAR_RECORD_KEY'));run(`testBegin('tree','clear');state.avTime=130;settleBattle()`);assert.equal(records.get(run('CLEAR_RECORD_KEY')),clearBefore);
assert(!html.includes('사이클'));assert(!html.includes('roundsCompleted'));assert(!html.includes('state.acted'));
console.log('PASS: AV scheduler, 2x-speed frequency, mid-wait speed expiration, action advance, 60/120/180 growth, timed effects, preview purity, DOT boundaries, lethal AV records, skipped actions, 24 deck limits and settlement.');
