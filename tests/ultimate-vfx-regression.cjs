const fs=require('fs'),vm=require('vm'),assert=require('assert');
const path=require('path'),root=path.resolve(__dirname,'..');let src=fs.readFileSync(root+'/assets/battle/particle-vfx.js','utf8');
// Capture sprite commands without a browser; retain the actual composition code.
src=src.replace(/function init\(\)\{[\s\S]*?\n function setQuality/, 'function init(){return true}\n function setQuality');
src=src.replace(/function particle\(spec\)\{[\s\S]*?\n function emit/, 'function particle(spec){captured.push(spec)}\n function emit');
src=src.replace(/function schedule\(delay,fn\)\{[^\n]*\}/,'function schedule(delay,fn){fn()}');
const captured=[],ctx=vm.createContext({captured,console,window:{addEventListener(){}},document:{addEventListener(){},querySelector(){return null}},matchMedia(){return {matches:false}},Math});vm.runInContext(src,ctx);
const v=ctx.window.ParticleVFX,ids=Object.keys(v.ultimateModifiers);assert.equal(ids.length,96);assert.equal(Object.keys(v.presets).length,24);v.setMonochrome(true);
const signatures=new Set();for(const id of ids){const deck=id.split('_')[0];const u=v.ultimateModifiers[id];assert(u.label&&u.layout&&u.motion);const cfg=v.config(deck,{actorId:id,tier:2});assert.strictEqual(cfg.ultimate,u);assert.equal(v.config(deck,{actorId:id,tier:1}).ultimate,null);signatures.add(JSON.stringify([deck,u]));captured.length=0;v.begin({x:400,y:200},deck,2,650,{actorId:id,origin:{x:100,y:250},support:id.endsWith('_3')});assert(captured.length>0,id);for(const p of captured)assert(Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.size));captured.length=0;v.effect({x:400,y:200},deck,'shield',{actorId:id,tier:2});assert(captured.length>0);}
assert.equal(signatures.size,96);assert(!src.includes('Math.random('));
// Replay contact composition in monochrome and verify all96 distinct geometric commands.
const forms=new Set();for(const id of ids){captured.length=0;v.contact({x:400,y:200},id.split('_')[0],2,{actorId:id,ordinal:0,state:{boss:{},shared:{}}});forms.add(JSON.stringify(captured.filter(p=>p.priority===2).map(p=>[p.texture,p.x,p.y,p.size,p.rotation,p.vx,p.vy,p.aspect])))}assert.equal(forms.size,96);
console.log('PASS:96 unique ultimate modifiers, monochrome silhouettes, preparation and support paths, finite particles, no combat RNG.');
