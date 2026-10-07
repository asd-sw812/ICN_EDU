/* Independent, pooled, batched WebGL sprite VFX. Does not read or mutate combat state. */
(()=>{
 'use strict';
 const TAU=Math.PI*2,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),rand=(a,b)=>a+random()*(b-a);
 let randomSeed=0x59c17;function random(){randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296}
 const types=['glow','flare','spark','chip','smoke','flame','ember','crystal','dust','wave','slash','arc','wisp','energy','motes','ring'];
 const TILE=256,ATLAS=TILE*4;
 const QUAD=[[-.5,-.5,0,0],[.5,-.5,1,0],[.5,.5,1,1],[-.5,-.5,0,0],[.5,.5,1,1],[-.5,.5,0,1]];
 const index=Object.fromEntries(types.map((t,i)=>[t,i]));
 const colors={physical:['#ffd9a0','#ff9554','#fff0cd'],slash:['#c0e9ff','#6d9fe8','#f2f5ff'],fire:['#ff732c','#ffd276','#ef4526'],ice:['#a8f4ff','#588ed5','#e9ffff'],electric:['#d0c3ff','#78b9ff','#fff7c9'],poison:['#b4d969','#6c9881','#d1b4e8'],magic:['#cbb2ff','#829fee','#f4deff'],heal:['#a9e5b2','#72b9b0','#f5ebc3']};
 const overrides={bleed:['#ff9d98','#d86a85','#ffe0d7'],wave:['#70cbdc','#88aeee','#d7f3ff'],tree:['#9fd699','#5da98a','#e6edb2'],radiance:['#ffdf9d','#cfb089','#fff5d5'],lifesteal:['#cf8ebf','#c35c80','#f4c7db'],wind:['#9ee6cf','#76b9c9','#ddfff3']};
 let canvas=null,root=null,gl=null,ctx=null,program=null,buffer=null,texture=null,atlas=null,failedGL=false,frame=0,last=0,clock=0,paused=false;
 // Pre-baked from makeAtlas(); procedural generation remains an offline/context fallback.
 const atlasImage=typeof Image==='function'?new Image():null;
 if(atlasImage&&document.currentScript?.src){atlasImage.onload=()=>{if(!atlas)atlas=atlasImage};const url=new URL('particle-atlas.png',document.currentScript.src);url.search=new URL(document.currentScript.src).search;atlasImage.src=url.href;}
 let width=1,height=1,pixelRatio=1,quality='auto',scale=1,limit=900,active=[],free=[],events=[],eventId=0,protectedRects=[];
 const CAP=1400,vertexData=new Float32Array(CAP*6*8),gpuRects=new Float32Array(8*4),metrics={spawned:0,dropped:0,peak:0,frames:0,cpu:[],dt:[],drawCalls:0,bursts:0};
 const rgb=hex=>{const n=parseInt(hex.slice(1),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]};
 function hash(x,y){const n=Math.sin(x*127.1+y*311.7)*43758.5453123;return n-Math.floor(n)}
 function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return(hash(ix,iy)*(1-u)+hash(ix+1,iy)*u)*(1-v)+(hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u)*v}
 function fbm(x,y){return noise(x,y)*.57+noise(x*2.1+3,y*2.1)*.28+noise(x*4.2,y*4.2+7)*.15}
 function segment(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)}
 function makeAtlas(){
  const c=document.createElement('canvas');c.width=c.height=ATLAS;const cx=c.getContext('2d'),im=cx.createImageData(ATLAS,ATLAS),data=im.data;
  const arcs=[[-.88,-.16],[-.61,.15],[-.41,-.06],[-.13,.28],[.03,-.10],[.27,.09],[.47,-.2],[.88,.02]];
  for(let tile=0;tile<16;tile++)for(let j=0;j<TILE;j++)for(let i=0;i<TILE;i++){
   const x=(i-(TILE-1)/2)/((TILE-1)/2),y=(j-(TILE-1)/2)/((TILE-1)/2),r=Math.hypot(x,y),n=fbm(x*4.5+tile*11,y*4.5),grain=hash(i+tile*47,j),edge=clamp((.97-Math.max(Math.abs(x),Math.abs(y)))*18);let a=0,l=.85;
   switch(types[tile]){
    case'glow':a=Math.exp(-r*r*6)*clamp((1-r)*4);l=.65+.35*Math.exp(-r*r*24);break;
    case'flare':a=clamp(Math.exp(-r*r*18)*.8+Math.exp(-x*x*180-y*y*4)*.55+Math.exp(-y*y*150-x*x*7)*.8)*(1-r*.5);l=1;break;
    case'spark':{const bend=.065*Math.sin(x*10);a=Math.exp(-Math.pow((y-bend)/(.035+.045*(1-x)),2))*clamp((1-Math.abs(x))*4);a+=Math.exp(-y*y*90-x*x*3)*.17;l=.7+.3*(1-Math.abs(x));break;}
    case'chip':{const angle=Math.atan2(y,x),outline=.56+.12*Math.sin(angle*5+1)+.08*Math.sin(angle*9)+.09*(n-.5);const cut=Math.abs(x+.32*y-.12)>.026&&Math.abs(y-.41*x+.2)>.019;a=clamp((outline-Math.hypot(x*1.2,y)) *28)*(cut?1:.15);l=clamp(.28+n*.7+(x<y*.2?.05:.22));break;}
    case'smoke':{const billow=fbm(x*5+n*2,y*5-n*2),rim=clamp((.8-r+(n-.5)*.5)*6);a=rim*Math.pow(clamp(billow*1.7-.3),1.2)*.8;l=.18+.68*billow+.14*clamp((noise(x*9,y*9)-.5)*4);break;}
    case'flame':{const yy=(y+1)*.5,bend=.18*Math.sin(y*7+n*2),spread=.1+yy*.55;a=clamp((1-Math.abs(x-bend)/spread)*2)*Math.pow(clamp(1-Math.abs(y)*1.04),.65)*(.25+.75*n);l=.45+.55*Math.exp(-x*x*20)*yy;break;}
    case'ember':a=Math.exp(-x*x*110-y*y*20)*(.7+.3*n)+Math.exp(-r*r*16)*.12;l=1;break;
    case'crystal':{const taper=(y<-.55?(.94+y)*.6:y>.45?(.94-y)*.45:.26)+.018*(n-.5),axis=x+.13*y;a=clamp((taper-Math.abs(axis))*36)*clamp((.88-Math.abs(y)) *25);const fracture=Math.abs(Math.sin(y*21+x*14))<.055;l=fracture?1:axis<-.05?.25+.22*n:axis>.1?.65+.3*n:.92;break;}
    case'dust':a=Math.exp(-r*r*8)*Math.pow(n,2)*.6;l=.6+.4*grain;break;
    case'wave':case'ring':{const angle=Math.atan2(y,x),rr=r+(n-.5)*.23+Math.sin(angle*7)*.04,crest=Math.exp(-Math.pow((rr-.58)/.13,2));a=crest*clamp(n*2-.35)*(.5+.5*Math.sin(angle*3+1)**2);a+=Math.exp(-Math.pow((rr-.69)/.035,2))*clamp(n*3-1.5)*.5;l=.45+.55*n;break;}
    case'slash':{const curve=.65*x*x-.27+(n-.5)*.11,width=.06+.23*clamp(1-x*x);const strand=noise(x*14,(y-curve)*48);a=Math.exp(-Math.pow((y-curve)/width,2))*Math.pow(clamp(1-x*x),.8)*clamp(.15+strand*1.5);l=.4+.6*strand;break;}
    case'arc':{let d=9;for(let z=0;z<arcs.length-1;z++)d=Math.min(d,segment(x,y,arcs[z],arcs[z+1]));for(let z=1;z<6;z+=2)d=Math.min(d,segment(x,y,arcs[z],[arcs[z][0]+.12,arcs[z][1]-.36]));a=Math.exp(-d*d*2800)+Math.exp(-d*d*130)*.24;l=1;break;}
    case'wisp':{const curve=.3*Math.sin(y*4.2+n*.7);a=Math.exp(-Math.pow((x-curve)/.21,2))*clamp(1-y*y)*n*.8;l=.7+.3*n;break;}
    case'energy':{const bend=.23*Math.sin(x*5+n),d=Math.hypot(x*.85,(y-bend)*1.9);a=clamp((.8-d+(n-.5)*.4)*5)*clamp(n*2-.3);const veins=noise(x*15,y*32);l=.32+.5*n+.3*clamp((veins-.55)*5);break;}
    case'motes':a=clamp((grain-.91)*13)*Math.exp(-r*r*3)+Math.exp(-r*r*14)*.1;l=1;break;
   }
   const k=(((tile>>2)*TILE+j)*ATLAS+(tile%4)*TILE+i)*4;data[k]=data[k+1]=data[k+2]=Math.round(clamp(l)*255);data[k+3]=Math.round(clamp(a*edge)*255);
  }
  cx.putImageData(im,0,0);return c;
 }
 function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
 function setupGL(){
  program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 pos;attribute vec2 uv;attribute vec4 color;uniform vec2 size;varying vec2 tex;varying vec4 tint;varying vec2 world;void main(){world=pos;tex=uv;tint=color;gl_Position=vec4(pos.x/size.x*2.-1.,1.-pos.y/size.y*2.,0.,1.);}'));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D atlas;uniform vec4 ui[8];varying vec2 tex;varying vec4 tint;varying vec2 world;void main(){for(int i=0;i<8;i++){if(world.x>ui[i].x&&world.y>ui[i].y&&world.x<ui[i].z&&world.y<ui[i].w)discard;}vec4 s=texture2D(atlas,tex);gl_FragColor=vec4(s.rgb*tint.rgb*tint.a,s.a*tint.a);}'));
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
  buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertexData.byteLength,gl.DYNAMIC_DRAW);
  for(const[n,count,offset]of[['pos',2,0],['uv',2,8],['color',4,16]]){const a=gl.getAttribLocation(program,n);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,count,gl.FLOAT,false,32,offset)}
  texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.enable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
 }
 function init(){
  if(canvas)return true;root=document.getElementById('vfxStage');if(!root)return false;
  atlas=atlas||makeAtlas();canvas=document.createElement('canvas');canvas.id='particleCanvas';canvas.setAttribute('aria-hidden','true');root.prepend(canvas);
  try{gl=failedGL?null:canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,powerPreference:'high-performance'});if(gl)setupGL()}catch(e){console.warn('Particle WebGL unavailable; using canvas fallback',e);gl=null;canvas.remove();canvas=document.createElement('canvas');canvas.id='particleCanvas';canvas.setAttribute('aria-hidden','true');root.prepend(canvas)}
  if(!gl)ctx=canvas.getContext('2d');
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();clear();failedGL=true;canvas.remove();canvas=null;gl=null;ctx=null});
  resize();return !!(gl||ctx);
 }
 function setQuality(value){quality=['auto','low','high'].includes(value)?value:'auto';resize()}
 function resize(){
  if(!canvas||!root)return;const r=root.getBoundingClientRect();width=root.clientWidth||r.width||1;height=root.clientHeight||r.height||1;
  const mobile=r.width<1050,weak=(navigator.hardwareConcurrency||8)<=4||(navigator.deviceMemory||8)<=4;
  scale=quality==='low'?.32:quality==='high'?1:mobile||weak?.62:1;limit=Math.round(900*scale);if(!gl){scale=Math.min(scale,.4);limit=Math.min(limit,280)}
  pixelRatio=Math.min(devicePixelRatio||1,quality==='low'?1:mobile?1.25:1.5);
  const cw=Math.max(1,Math.round(r.width*pixelRatio)),ch=Math.max(1,Math.round(r.height*pixelRatio));if(canvas.width!==cw)canvas.width=cw;if(canvas.height!==ch)canvas.height=ch;
  protectedRects=[];for(const selector of ['#skillPanel','.skill-detail','.party-grid','.turn-order','.fighter-label','.boss-card','.raid-hud','header .actions']){const el=document.querySelector(selector);if(!el)continue;const q=el.getBoundingClientRect();if(q.width&&q.height)protectedRects.push([(q.left-r.left)*width/(r.width||1),(q.top-r.top)*height/(r.height||1),(q.right-r.left)*width/(r.width||1),(q.bottom-r.top)*height/(r.height||1)])}
  gpuRects.fill(-9999);protectedRects.slice(0,8).forEach((a,i)=>gpuRects.set(a,i*4));
  if(gl){gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);gl.uniform2f(gl.getUniformLocation(program,'size'),width,height);gl.uniform4fv(gl.getUniformLocation(program,'ui[0]'),gpuRects);gl.uniform1i(gl.getUniformLocation(program,'atlas'),0)}
 }
 function wake(){if(!frame&&!paused&&!document.hidden){frame=requestAnimationFrame(tick)}}
 function schedule(delay,fn){events.push({at:clock+Math.max(0,delay),fn,id:++eventId});events.sort((a,b)=>a.at-b.at||a.id-b.id);wake()}
 function particle(spec){
  if(active.length>=limit){const victim=(spec.priority||0)>0?active.findIndex(p=>(p.priority||0)<spec.priority):-1;if(victim<0){metrics.dropped++;return}free.push(active[victim]);active[victim]=active[active.length-1];active.pop();metrics.dropped++;}const p=free.pop()||{};
  Object.assign(p,{x:0,y:0,vx:0,vy:0,ax:0,ay:0,drag:0,age:0,life:.5,size:16,aspect:1,rotation:0,spin:0,alpha:1,fade:.08,grow:0,shrink:.5,texture:'spark',blend:'add',color:[1,1,1],attract:0,tx:0,ty:0,turbulence:0,depth:1,trail:0,trailClock:0,stretch:0,priority:0},spec);
  p.tile=index[p.texture]??0;active.push(p);metrics.spawned++;metrics.peak=Math.max(metrics.peak,active.length);wake();
 }
 function emit(p,options={}){
  const o={count:30,textures:['spark','chip','dust'],palette:colors.physical,speed:[90,340],size:[8,24],life:[.25,.7],spread:TAU,direction:0,radius:6,gravity:180,drag:1.8,alpha:[.6,1],grow:0,blend:'add',...options};
  const count=Math.max(1,Math.round(o.count*scale*clamp((limit-active.length)/(limit*.45),.2,1)));for(let i=0;i<count;i++){
   const a=o.direction+rand(-o.spread/2,o.spread/2),speed=rand(...o.speed),r=rand(0,o.radius),j=rand(0,TAU),texture=o.textures[Math.floor(random()*o.textures.length)];
   const depth=o.depth??(random()<.2?2:random()<.3?0:1),z=[.65,1,1.5][depth];
   const spec={x:p.x+Math.cos(j)*r,y:p.y+Math.sin(j)*r,vx:Math.cos(a)*speed*z,vy:Math.sin(a)*speed*z,ax:rand(-25,25),ay:o.gravity*rand(.7,1.3),drag:rand(o.drag*.65,o.drag*1.35),life:rand(...o.life),size:rand(...o.size)*z,depth,trail:o.trail||0,stretch:o.stretch||0,aspect:texture==='spark'?rand(.4,.8):rand(.6,1.3),rotation:a+rand(-.8,.8),spin:rand(-5,5),alpha:rand(...o.alpha),color:rgb(o.palette[Math.floor(random()*o.palette.length)]),texture,blend:o.blend,grow:o.grow,shrink:o.shrink??.65,turbulence:o.turbulence||0,attract:o.attract||0,tx:p.x,ty:p.y,...o.particle};
   const delay=rand(0,o.delay||0);if(delay)schedule(delay,()=>particle(spec));else particle(spec);
  }
 }
 const tintCache=new Map();
 function tintedTile(p){
  const key=p.tile+':'+p.color.join(',');if(tintCache.has(key))return tintCache.get(key);
  const tile=document.createElement('canvas');tile.width=tile.height=TILE;const tc=tile.getContext('2d');
  tc.drawImage(atlas,(p.tile%4)*TILE,(p.tile>>2)*TILE,TILE,TILE,0,0,TILE,TILE);
  tc.globalCompositeOperation='multiply';tc.fillStyle='rgb('+p.color.map(x=>Math.round(x*255)).join(',')+')';tc.fillRect(0,0,TILE,TILE);
  tc.globalCompositeOperation='destination-in';tc.drawImage(atlas,(p.tile%4)*TILE,(p.tile>>2)*TILE,TILE,TILE,0,0,TILE,TILE);
  if(tintCache.size>=64)tintCache.delete(tintCache.keys().next().value);tintCache.set(key,tile);return tile;
 }
 function glow(p,palette,power=1,duration=.20){particle({x:p.x,y:p.y,texture:'glow',color:rgb(palette[0]),size:150*power,life:duration,alpha:.55,fade:.012,grow:.8,shrink:0});particle({x:p.x,y:p.y,texture:'flare',color:rgb(palette[2]),size:75*power,life:.065,alpha:.95,fade:.003,grow:.35,shrink:0})}
 function shock(p,palette,power=1,delay=.03){schedule(delay,()=>particle({x:p.x,y:p.y,texture:'wave',color:rgb(palette[0]),size:95*power,life:.4,alpha:.55,rotation:rand(0,TAU),fade:.012,grow:2.7,shrink:0,aspect:.8}))}
  // Preset metadata is grounded in game.DECKS, SUPPORT_ACTIONS and useSkill/passive logic.
 // Each row: mechanism, rhythm, silhouette, movement, contact, hit response, residue,
 // character gesture, strong-skill extension, identity (also used by QA/design inventory).
 const designRows={
  bullet:['개인 탄창 수급·소비','실제 탄환 타수의 짧은 점사','집중된 에너지 파열·불규칙 탄피','수평 관통','작은 집중점','짧은 반동','탄피 낙하','shot','소비량에 따른 압축 관통','탄창에서 이어지는 일직선'],
  poison:['중독/맹독 유지·전환·결산','부여 후 정체, 결산 시 수축','덩어리 안개','느린 부유·중심 수렴','결산 응축','탁한 분산','실제 중독 수의 군집','cast','맹독층과 결산 와류','여러 안개 군집이 소거됨'],
  counter:['개인 저장 피해·보호막·피격 반격','받은 타격 뒤 짧은 정적과 반전','각진 방벽·쐐기','방어면에서 역방향 방출','역류 쐐기','방벽 압축','보호막 조각','brace','실제 저장량을 압력으로 환산','피격 방향을 되돌림'],
  follow:['개인 추격 자원·실제 추가타','실제 타수를 연결한 교차 리듬','대각 절개','이전 타점에서 다음 타점','엇갈린 절개','연결된 타점','끊어지는 작은 궤적','melee','실제 추가타만 후속 절개','서로 이어지는 교차선'],
  freeze:['한기 5→빙결·현실피해 해제/방지','쌓임→정지→해제 파편','세로 결정','아래에서 솟아 정착','좁은 결정 열','빙결 때 외곽 잠금','실제 한기·빙결 표시','cast','빙결 생성/해제에만 격자/파편','정지된 뾰족한 외곽'],
  lifesteal:['피해→흡혈·초과회복 피해 전환','공격 후 실제 회복 방향으로 귀환','가는 생명선','적→회복 대상','갈고리 곡선','얇은 수축','회복 대상에 소실','draw','초과회복 추가 피해도 실제 이벤트','회복 시 방향이 뒤집힘'],
  bounce:['한 보스에 바운스 다단 집중','실제 타수만 왕복','굴절 결정·분열된 에너지 꼬리','각 타점 바깥→같은 보스로 복귀','각진 왕복','타마다 다른 반사축','외곽에 짧은 잔향','cast','실제 타수만 경로 연장','보스 외곽을 왕복'],
  hp:['개인 HP 소모·희생량 소비·최대HP 계수','몸에서 빠져나가 한 점에 집중','응축된 섬유 흐름·긴 에너지 파열','실제 소모 자원→적','세로 희생 창','좁은 압력','사용자에게 빈 실','draw','실제 HP/희생량 소비에만 변환선','사용자에서 에너지가 빠짐'],
  speed:['속도 계수·실제 회피','짧고 빠른 일격','긴 수평 잔상','좁은 직진','수평 가속선','짧은 옆밀림','짧은 잔상','dash','실제 회피 이벤트는 옆으로 이탈','수평의 짧은 시간축'],
  debuff:['실제 디버프 종류 수로 피해 강화','종류가 늘면 서로 다른 축 중첩','비대칭 봉인 띠','엇갈린 축으로 수렴','서로 접히는 에너지 띠','축별 접힘','실제 디버프 종류 표식','cast','종류 수에 따라 축 증가','서로 어긋나 수렴하는 질감 띠'],
  ult:['에너지 지원·실제 무료 궁극기 재현','순환→실제 재현자의 별도 타점','궤도·공명 고리','회전·아군 에너지 전달','공명 수축','재현자 축을 구별','에너지 수급 고리','cast','실제 재현 이벤트만 에코','아군 사이를 잇는 순환'],
  enhance:['강화 지속·강화 상태에서 스킬 변경','강화 전 단층, 강화 후 이중 프레임','분절된 에너지 덩어리','단계별 프레임 전개','프레임 압착','강화 여부에 따라 이중 외곽','실제 강화 지속 표시','brace','강화 상태일 때만 추가 프레임','강화 뒤 직교하는 이중 에너지 파열'],
  skill:['2스킬 증폭 축적·1스킬 방출·SP 최대치','쌓는 행동과 소비 행동 분리','층층의 판','수직 정렬→중심 방출','판 압착','증폭량 따라 층 밀도','개인 실제 증폭 표시','cast','실제 증폭 소비 때 판 해체','세로 쌓이는 판'],
  execute:['방어 관통·실제 처형 조건 판정','집중된 한 번의 수직 절단','긴 수직 절개 질감','위→아래','관통 절단','실제 처형 추가 피해에만 닫힘','가는 낙하 먼지','melee','실제 성공 때만 종결선','수직 파열과 응축 종결'],
  crit:['높은 치명타·확정 치명 궁극기','한 점 집중, 실제 치명 때 선명한 분기','압축 핵·갈라지는 질감의 섬광','중심 압축','핀포인트','실제 치명일 때만 십자','미세한 점','melee','실제 치명 여부로 날카로운 중심','아주 작은 집중점'],
  cleanse:['실제 디버프 제거·회복·정화 자원','밖으로 씻어내고 회복 상승','빗살·흩어지는 먼지','안→밖, 회복 위로','정돈된 빗살','실제 제거 때만 잔여 찌꺼기 방출','깨끗한 수직 미립자','support','실제 제거 개수만 정화선','외곽으로 쓸어냄'],
  burn:['연소10→맹염·화상·턴 시작 DOT','점화 뒤 위로 지속, 실제 틱에 맥동','불꽃·재','위로 상승','불꽃 기둥','스택/맹염에 따른 높이','실제 상태 동안 불씨','cast','실제 맹염 전환 때 이중 기둥','상향 흐름과 잔불'],
  bleed:['행동 후 출혈·즉시 결산','상처→실제 틱·결산','가는 절개·방울','아래로 드리움','낮은 대각 상처','실제 결산 때 아래로 수렴','실제 출혈 스택의 실','melee','결산 이벤트에만 방울 응축','아래로 드리우는 가는 실'],
  electric:['개인 전류·전하 임계 마비·강화 플래그','불규칙 짧은 점멸→마비 정착','분기 아크','꺾이는 순간 경로','분기 방전','실제 마비 때 외곽 잠금','실제 전하 수의 노드','cast','소비/강화 플래그에 따른 긴 아크','끊기는 분기와 노드'],
  defense:['방어 상승·개인 축적피해·방어계수','방벽 적층→저장량 압력 방출','균열난 덩어리·지면 파편','수평 적층·아래로 무게','넓은 압력면','실제 축적량 따른 압착','보호막/방어 실제 적층','brace','개인 저장량 소비 때 부채꼴 압력','낮고 무거운 적층면'],
  radiance:['공용 광휘·광채·실제 고정 추가피해','기본 타격→실제 고정피해 섬광','긴 세로 빛줄기·굴절 결정','위아래 대칭','빛 기둥','광휘에 비례한 타일 밀도','실제 광채 위성','cast','고정피해 이벤트를 별도 표현','수직 빛과 정지 위성'],
  wave:['10% 이상 궁극기·실제 에너지 4구간','물결 한 번, 에너지 구간별 파고','넓은 타원 물마루','수평 휘감김','눕힌 물마루','실제 시전 에너지에 따른 높이','옆으로 흘러가는 물안개','cast','10/36/71/100 구간별 마루 구조','수평 타원과 물마루'],
  tree:['3사이클 새싹→나무·이후2사이클 성장·3상한','새싹 한 줄→실제 성장별 분기','줄기·잎','아래→위 분기','뻗어 나가는 가지','실제 나무 스택에 따른 분기','실제 새싹/나무 실루엣','cast','실제 성장 수에 따른 가지 추가','아래에서 자라는 분기'],
  wind:['공용풍력·15 치명/감소·30 실제 추가치명','접선 회전→실제 30 추가타','회전 초승달','접선 소용돌이','원주 절개','15 이상 이중 궤도','실제 풍력 원주','dash','30 추가치명 이벤트만 두 번째 접선','원주에 붙어 도는 흐름']
 };
 const palettes={bullet:colors.physical,poison:colors.poison,counter:['#b9d3ed','#6480a3','#edf7ff'],follow:['#efbc91','#b78061','#fff1d6'],freeze:colors.ice,lifesteal:overrides.lifesteal,bounce:['#c7bbeb','#8278ba','#f2ebff'],hp:['#dc96aa','#b45b79','#ffdae1'],speed:colors.slash,debuff:colors.magic,ult:['#eadbad','#af9a73','#fff5d4'],enhance:['#92d7ce','#5c9ba6','#e4fff5'],skill:colors.magic,execute:['#d5b6aa','#966f79','#fff0df'],crit:colors.physical,cleanse:colors.heal,burn:colors.fire,bleed:overrides.bleed,electric:colors.electric,defense:['#b9c7d2','#73858f','#edf4ed'],radiance:overrides.radiance,wave:overrides.wave,tree:overrides.tree,wind:overrides.wind};
 const variantRows={
  bullet:['집중 탄창','탄환 공급','좁은 관통','탄창 보호'],poison:['독 결산','중독 전환','기간 유지','독 반응 회복'],counter:['저장 피해 응수','반격 지원','피해 기록','방벽 재생'],follow:['연속 추격','취기 후속','확률 난입','전의 보호'],freeze:['빙결 생성','속도 저하','해제 방지','피격 한기'],lifesteal:['초과 회복 전환','연구 지원','취약 흡혈','긴급 회복'],bounce:['연속 잔향','치명 반사','횟수 지원','타수 회복'],hp:['희생 폭딜','최대HP 지원','저체력 버프','윤회 보호'],speed:['속도 일격','속도 지원','파티 가속','회피 보호'],debuff:['종류 결산','공방 감소','속도 유지','피격 잔향'],ult:['에너지 딜러','무료 재현','파티 에너지','궁 회복'],enhance:['강화 일격','강화 복사','에너지 지원','강화 보호'],skill:['증폭 방출','SP 반환','증폭 전달','사용 횟수 회복'],execute:['조건 처형','방어 감소','취약 지원','저체력 보호'],crit:['집중 치명','확정 치명 지원','취약 표적','치명 보호'],cleanse:['정화 피해','제거 후 공격 지원','제거 후 방어 지원','대량 치료'],burn:['맹염 전환','화상 증폭','즉시 연소','틱 회복'],bleed:['결산 혈흔','중첩 원한','강제 결산','피격 출혈'],electric:['전류 소비 강화','전류 전달','마비 임계','피격 전류'],defense:['축적 방어 폭딜','방어 증폭','저장 지원','도발 축적'],radiance:['고정 피해 증폭','광채 추가','광휘 보존','광휘 보호'],wave:['에너지 치명','에너지 공격 지원','에너지 방어 감소','에너지 회복'],tree:['공격 성장','치명 성장','에너지 성장','회복 방어 성장'],wind:['15 치피','풍력 수급','30 추가타','15 방풍']
 };
 const charShape=[{angle:-.32,spread:.55,size:1.12,speed:1.15,offset:-10},{angle:.35,spread:1.8,size:.87,speed:1.04,offset:12},{angle:-1.05,spread:1.05,size:.96,speed:.9,offset:-24},{angle:.8,spread:2.4,size:1.2,speed:.78,offset:28}];
 const presets=Object.fromEntries(Object.entries(designRows).map(([id,r])=>[id,{id,mechanism:r[0],rhythm:r[1],shape:r[2],movement:r[3],main:r[4],response:r[5],residue:r[6],motion:r[7],strong:r[8],identity:r[9],palette:palettes[id]}]));
 // Cosmetic composition only: a silhouette changes one observed contact, never its hit count.
 // Assignments follow each operative's existing resource, passive and support role.
 const compositions={
  focus:{aspect:.82,density:.9,radius:.7,residue:.8,axis:0,spin:.75,spacing:.7},
  fan:{aspect:.9,density:1.12,radius:1.35,residue:1,axis:.16,spin:1.1,spacing:1.25},
  needle:{aspect:.58,density:.82,radius:.55,residue:.7,axis:-.12,spin:.45,spacing:.65},
  heavy:{aspect:1.18,density:.92,radius:1.2,residue:1.2,axis:.12,spin:.65,spacing:1.1},
  coil:{aspect:.85,density:1.05,radius:1.15,residue:1.15,axis:-.2,spin:1.45,spacing:1},
  veil:{aspect:1.12,density:1.08,radius:1.3,residue:1.25,axis:.08,spin:.7,spacing:1.2},
  rake:{aspect:.72,density:1.05,radius:1,residue:.85,axis:-.28,spin:1.15,spacing:1.4},
  rise:{aspect:.8,density:.95,radius:.85,residue:1.15,axis:-.1,spin:.8,spacing:.9}
 };
 const compositionRows={
  bullet:['focus','fan','needle','heavy'],poison:['coil','fan','veil','rise'],
  counter:['heavy','rake','focus','veil'],follow:['rake','coil','needle','heavy'],
  freeze:['rise','fan','needle','heavy'],lifesteal:['coil','fan','rake','rise'],
  bounce:['rake','focus','coil','rise'],hp:['needle','heavy','veil','coil'],
  speed:['needle','rake','fan','veil'],debuff:['coil','rake','veil','heavy'],
  ult:['focus','rake','coil','rise'],enhance:['heavy','rake','fan','veil'],
  skill:['focus','coil','needle','rise'],execute:['needle','rake','fan','heavy'],
  crit:['focus','needle','rake','heavy'],cleanse:['rake','fan','needle','rise'],
  burn:['rise','veil','focus','coil'],bleed:['needle','rake','coil','heavy'],
  electric:['focus','rake','coil','heavy'],defense:['heavy','fan','focus','veil'],
  radiance:['needle','fan','coil','heavy'],wave:['focus','fan','rake','coil'],
  tree:['rise','rake','needle','veil'],wind:['needle','fan','coil','heavy']
 };
 const characterModifiers=Object.fromEntries(Object.keys(presets).flatMap(id=>charShape.map((v,i)=>{
  const composition=compositionRows[id][i];return [id+'_'+i,{...v,...compositions[composition],composition,label:variantRows[id][i]}];
 })));
 const skillModifiers=[{label:'1스킬',size:.82,density:.75,residue:.5},{label:'2스킬',size:1,density:1,residue:.75},{label:'궁극기',size:1.32,density:1.2,residue:1}];
 let ambient=[],monochrome=false;const shakes=new Set();
 function shake(target,strength,duration=140){
  if(!target||!strength||quality==='low'||matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const anim=target.animate([{translate:'0px 0px'},{translate:`${-strength}px 1px`,offset:.2},{translate:`${strength*.5}px 0px`,offset:.5},{translate:'0px 0px'}],{duration,fill:'none'});shakes.add(anim);
  anim.onfinish=()=>{shakes.delete(anim);anim.cancel()};anim.oncancel=()=>shakes.delete(anim);
 }
 const effectMetrics={contacts:0,byDeck:{},byActor:{},kinds:{}};
 function config(deck,custom={}){
  const preset=presets[deck];if(!preset)return null;
  const actorSlot=custom.actorId?.startsWith(deck+'_')?Number(custom.actorId.split('_').pop()):undefined;
  const slot=Math.max(0,Math.min(3,Number.isInteger(actorSlot)?actorSlot:custom.slot??0));
  const character=characterModifiers[deck+'_'+slot],skill=skillModifiers[custom.tier||0];
  const speed=character.speed*(['speed','wind'].includes(deck)&&custom.effectiveSpeed?clamp(custom.effectiveSpeed/120,.7,1.8):1);
  return {...preset,...character,speed,skill,palette:monochrome?['#bdbdbd','#777777','#ffffff']:preset.palette,...custom};
 }
 function sprite(p,c,texture,size,options={}){const spec={x:p.x,y:p.y,texture,color:rgb(c.palette[options.tint??0]),size:size*c.size*(c.skill?.size||1),life:.32,alpha:.8,fade:.012,shrink:0,priority:1,...options};spec.aspect=(spec.aspect||1)*(c.aspect||1);spec.spin=(spec.spin||0)*(c.spin||1);spec.vx=(spec.vx||0)*c.speed;spec.vy=(spec.vy||0)*c.speed;spec.life/=c.speed;particle(spec)}
 function scatter(p,c,textures,options={}){const spec={palette:c.palette,textures,count:Math.round(22*(c.skill?.density||1)),size:[6,18],speed:[65,230],direction:c.angle,spread:c.spread,gravity:20,life:[.18,.55],...options};spec.count=Math.round(spec.count*(c.density||1));spec.radius=(spec.radius??6)*(c.radius||1);spec.size=spec.size.map(n=>n*c.size);spec.speed=spec.speed.map(n=>n*c.speed);spec.life=spec.life.map(n=>n*(c.residue||1)/c.speed);emit(p,spec)}
 function line(a,b,c,texture='spark',options={}){const dx=b.x-a.x,dy=b.y-a.y;const p={x:(a.x+b.x)/2,y:(a.y+b.y)/2};sprite(p,c,texture,Math.hypot(dx,dy),{rotation:Math.atan2(dy,dx),aspect:.1,life:.2,...options})}
 function orbit(p,c,texture,count,radius,options={}){const {size=28,...rest}=options;radius*=c.radius||1;for(let i=0;i<count;i++){const a=i/count*TAU+c.angle;const q={x:p.x+Math.cos(a)*radius,y:p.y+Math.sin(a)*radius*(c.composition==='heavy'?.42:c.composition==='rise'?1:.7)};sprite(q,c,texture,size,{rotation:a+Math.PI/2,vx:-Math.sin(a)*75,vy:Math.cos(a)*50,life:.45,...rest})}}
 function transfer(a,b,deck,custom={}){
  if(!init())return;const c=config(deck,custom);if(!c)return;
  const texture=deck==='lifesteal'||deck==='hp'?'wisp':deck==='bullet'?'chip':deck==='electric'?'arc':'energy';
  const dx=b.x-a.x,dy=b.y-a.y,duration=.28,angle=Math.atan2(dy,dx);
  for(let i=0;i<Math.min(12,Math.max(3,custom.amount||4));i++)schedule(i*.014,()=>sprite(a,c,texture,18,{rotation:angle,aspect:.35,vx:dx/duration,vy:dy/duration,life:duration,alpha:.55}));
 }
 function begin(p,deck,tier,windup,custom={}){
  if(!init())return;resize();const c=config(deck,{...custom,tier});if(!c)return;
  // Anticipation uses the existing windup. It never delays resolution or schedules damage.
  const life=Math.max(.1,windup/1000),from=custom.origin||p,texture=envelopes[deck][0];
  scatter(from,c,[texture,'motes'],{count:12+tier*5,radius:65,speed:[8,30],attract:180,gravity:0,
   size:[10,28],life:[life*.65,life],alpha:[.3,.65],delay:life*.22,spread:TAU});
  schedule(Math.max(0,life-.15),()=>{
   sprite(from,c,texture,90+tier*25,{life:.2,alpha:.5,grow:-.4});
   const dx=p.x-from.x,dy=p.y-from.y,distance=Math.hypot(dx,dy);
   if(distance<90)return;
   const duration=.16,angle=Math.atan2(dy,dx);
   // The cast trail is a cluster of textured fragments, not another logical hit.
   for(let i=0;i<7+tier*3;i++)schedule(i*.004,()=>{
    const lateral=c.composition==='fan'?((i%3)-1)*32:c.composition==='coil'?Math.sin(i*1.7)*28:c.composition==='needle'?rand(-5,5):rand(-20,20);
    const start={x:from.x-Math.sin(angle)*lateral+rand(-12,12),y:from.y+Math.cos(angle)*lateral};
    sprite(start,c,texture,rand(35,85),{rotation:angle,aspect:rand(.4,.85),vx:(p.x-start.x)/duration/c.speed,vy:(p.y-start.y)/duration/c.speed,life:duration*c.speed,alpha:rand(.3,.7),trail:.075,depth:i%3});
   });
  });
 }
 // Texture families govern volume, debris, direction and residue independently of colour.
 // These are cosmetic envelopes around ONE observed hit, not extra attacks or statuses.
 const envelopes={
  bullet:['energy','chip',0,.65,300,240],poison:['smoke','wisp',-1.57,4,45,-16],
  counter:['chip','chip',0,.9,280,240],follow:['slash','spark',-.7,1.5,310,90],
  freeze:['crystal','crystal',-1.57,1.5,220,240],lifesteal:['wisp','energy',2.7,1.1,160,-15],
  bounce:['energy','crystal',0,.6,290,0],hp:['wisp','ember',1.57,.65,190,80],
  speed:['slash','spark',0,.25,440,0],debuff:['energy','motes',-1.57,3,100,-12],
  ult:['wisp','energy',0,6.28,150,0],enhance:['energy','chip',-.7,2,230,120],
  skill:['energy','crystal',-1.57,.7,210,-25],execute:['slash','chip',1.57,.6,340,310],
  crit:['energy','spark',0,6.28,350,0],cleanse:['wisp','motes',-1.57,2.8,120,-25],
  burn:['flame','ember',-1.57,1.3,160,-95],bleed:['wisp','ember',1.57,.9,130,210],
  electric:['arc','spark',0,6.28,340,0],defense:['chip','chip',1.57,2.7,220,380],
  radiance:['wisp','crystal',-1.57,.75,210,-30],wave:['wisp','energy',0,.8,200,30],
  tree:['energy','energy',-1.57,1.8,135,-40],wind:['slash','wisp',-.5,2,260,-5]
 };
 function layers(q,c,custom){
  const [volume,debris,axis,spread,velocity,gravity]=envelopes[c.id],tier=c.tier||0;
  const direction=c.id==='counter'&&custom.reactive?Math.atan2(q.y-custom.origin.y,q.x-custom.origin.x):axis+c.angle*.35+(c.axis||0);
  const dot=custom.dot&&!custom.settlement,density=dot?.55:1,power=dot?.8:1;
  // Rear volume: irregular opaque smoke against the background gives the bright edge contrast.
  scatter(q,c,['smoke'],{count:4+tier*2,size:[85*power,150*power],speed:[15,65],direction,spread,
   gravity:gravity*.08,life:[.45,.85],alpha:[.22,.42],blend:'normal',depth:0,grow:1.1,delay:.055,tint:1});
  // The brief core peaks now; the detailed middle shell survives it instead of becoming a white disc.
  sprite(q,c,'flare',tier===2?110:70,{life:.055,alpha:dot?.45:.9,tint:2,depth:1});
  scatter(q,c,[volume],{count:5+tier*2,size:[65*power,120*power],speed:[velocity*.2,velocity*.65],direction,spread,
   gravity:gravity*.2,life:[.22,.48],alpha:[.4,.65],radius:28,grow:.65,depth:1,delay:.025});
  scatter(q,c,[debris,'spark'],{count:Math.round((22+tier*14)*density),size:[7,23],speed:[velocity*.65,velocity*1.7],direction,spread,
   gravity,life:[.28,.65],radius:30,alpha:[.65,.95],delay:.045,trail:.09,stretch:.6});
  // Broken, textured pressure edge, then delayed debris and slow residue: separate clocks/lifetimes.
  if(!dot)schedule(.025,()=>sprite(q,c,'wave',155+tier*36,{rotation:direction,aspect:spread<1.6?.48:.85,
   life:.30,alpha:.42,grow:1.25,depth:0}));
  schedule(.07,()=>scatter(q,c,[debris],{count:Math.round((12+tier*8)*density),size:[14,35],speed:[55,velocity*.7],
   direction:direction+.4,spread:spread+1,gravity,life:[.45,.95],alpha:[.45,.8],delay:.12,drag:1.3}));
  schedule(.13,()=>scatter(q,c,[volume==='flame'?'ember':volume==='crystal'?'crystal':'dust','motes'],{
   count:Math.round((12+tier*9)*density),size:[5,13],radius:40,speed:[12,55],direction,spread:spread+1,
   gravity:gravity*.15,life:[.65,1.25],alpha:[.35,.8],delay:.17,turbulence:20,depth:0}));
 }
 function contact(p,deck,tier=0,custom={}){
  if(!init())return;resize();const c=config(deck,{...custom,tier});if(!c)return;
  effectMetrics.contacts++;effectMetrics.byDeck[deck]=(effectMetrics.byDeck[deck]||0)+1;const actor=custom.actorId||deck+'_0';effectMetrics.byActor[actor]=(effectMetrics.byActor[actor]||0)+1;const kind=custom.kind||'damage';effectMetrics.kinds[kind]=(effectMetrics.kinds[kind]||0)+1;
  const n=custom.ordinal||0,origin=custom.origin||p,state=custom.state||{},boss=state.boss||{},shared=state.shared||{};
  c.size*=1+Math.min(1,(custom.spent||0)/8)*.25;
  const q={x:p.x+Math.sin(n*2.4+c.angle)*18,y:p.y+c.offset+Math.cos(n*1.7)*12};
  layers(q,c,{...custom,origin});
  const main=(texture,size,opts={})=>sprite(q,c,texture,size,{life:.38,alpha:.7,...opts});
  const plume=(texture,angle,size,count=3,opts={})=>{
   for(let i=0;i<count;i++)schedule(i*.018/c.speed,()=>sprite({x:q.x+Math.cos(angle)*i*16*c.spacing-Math.sin(angle)*(c.composition==='rake'?(i-(count-1)/2)*30:0),y:q.y+Math.sin(angle)*i*16*c.spacing+Math.cos(angle)*(c.composition==='rake'?(i-(count-1)/2)*30:0)},c,texture,size-i*22,
    {rotation:angle+(texture==='flame'?Math.PI/2:0),aspect:.65,life:.35+i*.045,vx:Math.cos(angle)*65,vy:Math.sin(angle)*65,alpha:.5,...opts}));
  };
  switch(deck){
   case 'bullet':plume('energy',c.angle*.25,235,3,{aspect:.38,life:.23,vx:230});
    scatter(q,c,['chip'],{count:16,direction:2.4,spread:.8,gravity:380,speed:[100,230],size:[10,23],life:[.45,.8],delay:.07});break;
   case 'poison':{
    const settle=custom.dot&&custom.settlement;
    scatter(q,c,['smoke','wisp'],{count:16,size:[70,135],radius:settle?90:40,attract:settle?720:0,speed:[15,50],spread:TAU,gravity:-15,life:[.75,1.4],alpha:[.35,.65],blend:'normal',turbulence:32});
    if(settle)schedule(.09,()=>main('energy',200,{grow:-.65,life:.32}));break;
   }
   case 'counter':{
    const angle=custom.reactive?Math.atan2(q.y-origin.y,q.x-origin.x):c.angle;
    plume('energy',angle,235,3,{aspect:.7});
    for(let i=0;i<3;i++)sprite({x:q.x-28+i*28,y:q.y},c,'chip',105,{rotation:angle,aspect:.8,vx:Math.cos(angle)*140,vy:Math.sin(angle)*140,life:.38});break;
   }
   case 'follow':plume('slash',(n%2?1:-1)*(.7+c.angle),290,2,{aspect:.85,life:.24});break;
   case 'freeze':
    for(let i=0;i<5;i++)schedule(i*.015,()=>sprite({x:q.x+(i-2)*26,y:q.y+35},c,'crystal',150-Math.abs(i-2)*25,{rotation:(i-2)*.16,vy:-100,life:.6,aspect:.75}));
    scatter(q,c,['smoke'],{count:7,size:[70,100],direction:0,spread:TAU,speed:[40,95],gravity:10,life:[.5,.9],alpha:[.3,.5],blend:'normal'});break;
   case 'lifesteal':plume('slash',-1+c.angle,265,2,{aspect:.85});orbit(q,c,'wisp',6,75,{size:80,attract:400,tx:q.x,ty:q.y,life:.6,spin:2});break;
   case 'bounce':{const angle=n*2.399+c.angle;plume('energy',angle,220,3,{aspect:.4});
    const outside={x:q.x+Math.cos(angle)*110,y:q.y+Math.sin(angle)*80};sprite(outside,c,'crystal',65,{rotation:angle,life:.4,spin:3});break;}
   case 'hp':plume('wisp',Math.PI/2,300,4,{aspect:.55,life:.48});main('energy',185,{rotation:Math.PI/2,grow:-.5});break;
   case 'speed':plume('slash',c.angle*.2,340,3,{aspect:.5,vx:400,life:.16});break;
   case 'debuff':{const count=Math.min(5,Math.max(1,custom.debuffCount||1));for(let i=0;i<count;i++)schedule(i*.022,()=>main('wisp',230,{rotation:i*1.15+c.angle,aspect:.6,grow:-.4,life:.55}));break;}
   case 'ult':orbit(q,c,'wisp',5,80,{size:130,life:.6,spin:3,attract:180,tx:q.x,ty:q.y});main('energy',160,{grow:-.6,life:.4});break;
   case 'enhance':{const upgraded=custom.enhanced>0||custom.passiveFlag;plume('energy',c.angle,220,3);
    if(upgraded)schedule(.035,()=>plume('energy',c.angle+Math.PI/2,240,3,{tint:2}));break;}
   case 'skill':{const layers=Math.min(6,1+Math.ceil((custom.resource||0)/2));for(let i=0;i<layers;i++)schedule(i*.017,()=>sprite({x:q.x,y:q.y+35-i*26},c,'energy',190,{aspect:.48,life:.4,vy:custom.spent?-110:25,rotation:c.angle*.2}));break;}
   case 'execute':plume('slash',Math.PI/2,360,2,{aspect:.65,vy:210,life:.27});
    if(custom.executed)schedule(.065,()=>main('energy',245,{rotation:Math.PI/2,grow:-.75,life:.3}));break;
   case 'crit':main('energy',custom.crit?190:120,{grow:-.7,life:.26});
    if(custom.crit){plume('slash',c.angle,260,1,{aspect:.65,life:.26});plume('slash',c.angle+Math.PI/2,220,1,{aspect:.65,life:.23});}break;
   case 'cleanse':for(let i=0;i<5;i++)schedule(i*.023,()=>sprite({x:q.x-65+i*30,y:q.y+15},c,'wisp',170,{vy:-110,aspect:.65,life:.6,rotation:0}));break;
   case 'burn':
    scatter(q,c,['flame'],{count:12+(boss.inferno?6:0),size:[155,250+(boss.inferno?45:0)],radius:40,direction:-Math.PI/2,spread:.8,speed:[55,150],gravity:-70,life:[.55,1.1],alpha:[.45,.75],delay:.11,blend:'normal',particle:{rotation:0,spin:.3}});
    schedule(.15,()=>scatter(q,c,['smoke'],{count:8,size:[90,155],direction:-Math.PI/2,spread:.7,speed:[25,70],gravity:-15,life:[.8,1.25],alpha:[.28,.45],blend:'normal',grow:.65,depth:0}));break;
   case 'bleed':plume('slash',.35+c.angle,280,2,{aspect:.6,life:.3});
    for(let i=0;i<5;i++)sprite({x:q.x+(i-2)*22,y:q.y+20},c,'wisp',100,{vy:90,ay:160,life:.7,aspect:.4});break;
   case 'electric':for(let i=0;i<5;i++)schedule(i*.022,()=>main('arc',240+(custom.spent||0)*5,{rotation:i*1.4+c.angle,life:.12,aspect:.8}));break;
   case 'defense':
    for(let i=0;i<4;i++)sprite({x:q.x+(i-1.5)*38,y:q.y+25},c,'chip',135,{vy:50,ay:220,life:.45,rotation:i*.8});
    sprite({x:q.x,y:q.y+65},c,'wave',310,{aspect:.4,life:.55,grow:1.1});break;
   case 'radiance':plume('wisp',-Math.PI/2,350,3,{aspect:.7,life:.5});
    orbit(q,c,'crystal',Math.max(2,Math.min(8,shared.glow||2)),85,{size:38,life:.6,vx:0,vy:-25});break;
   case 'wave':{const level=custom.waveTier||1;plume('slash',.1,250+level*32,3,{aspect:.8,vx:140,life:.48});
    main('wave',240+level*22,{aspect:.5+level*.05,grow:.7,life:.6});break;}
   case 'tree':{const growth=shared.tree||0;plume('wisp',-Math.PI/2,225,2,{aspect:.55,life:.65});
    for(let i=0;i<=growth;i++){const sign=i%2?1:-1;const point={x:q.x+sign*(45+i*20),y:q.y-15-i*30};schedule(i*.04,()=>sprite(point,c,'energy',120,{rotation:sign*.7,aspect:.5,life:.8,vy:-35}));}break;}
   case 'wind':{const lanes=(shared.wind||0)>=15?2:1;for(let i=0;i<lanes;i++)orbit(q,c,'slash',3,65+i*30,{size:205,aspect:.75,life:.48,spin:4});break;}
  }
  shake(document.querySelector(custom.targetSelector||'.boss-figure'),tier===2?7:3,145);
  if(tier===2&&!custom.dot&&n===0)shake(root,2.5,95);
 }

 function effect(p,deck,kind,custom={}){
  if(!init())return;resize();const c=config(deck,custom);if(!c)return;
  effectMetrics.kinds[kind]=(effectMetrics.kinds[kind]||0)+1;
  const texture={freeze:'crystal',counter:'chip',defense:'chip',burn:'ember',bleed:'wisp',electric:'arc',tree:'energy',wind:'slash',bullet:'chip',debuff:'energy',skill:'chip',radiance:'flare'}[deck]||'wisp';
  if(kind==='shield'){
   orbit(p,c,texture,5,58,{size:64,life:.65,vx:0,vy:0,spin:0,alpha:.55});sprite(p,c,'wave',170,{aspect:deck==='defense'||deck==='counter'?.65:1,life:.5,alpha:.38,grow:.3});
   schedule(.07,()=>scatter(p,c,[texture,'dust'],{count:18,radius:50,size:[8,22],speed:[20,60],gravity:-10,life:[.4,.8],delay:.1,spread:TAU}));
  }else if(kind==='heal'){
   scatter(p,c,[texture,'motes'],{direction:-Math.PI/2,spread:.45,gravity:-15,speed:[25,65],count:24,size:[12,30],radius:35,life:[.45,.85],delay:.14});
   if(deck==='lifesteal'&&custom.origin)transfer(custom.origin,p,deck,custom);
  }else if(kind==='evade'){
   for(let i=0;i<3;i++)sprite({x:p.x-i*30,y:p.y},c,'slash',100,{rotation:0,aspect:.2,vx:-200,life:.12+i*.035,alpha:.25});
  }else if(kind==='cleanse'){
   scatter(p,c,['dust','wisp'],{count:12*(custom.amount||1),radius:8,speed:[80,140],spread:TAU,life:[.25,.6],gravity:0});
  }else{
   orbit(p,c,texture,3,28,{size:20,life:.5,alpha:.45,spin:custom.negative?-2:1});
  }
 }
 function incoming(p,deck,custom={}){
  if(!init())return;resize();const c=config(deck,custom);if(!c)return;
  effectMetrics.kinds.incoming=(effectMetrics.kinds.incoming||0)+1;
  // Boss damage is a neutral contact. Its attack is not re-labelled as the party deck.
  const neutral={...c,palette:monochrome?['#bdbdbd','#777777','#ffffff']:colors.physical};
  const direction=custom.origin?Math.atan2(p.y-custom.origin.y,p.x-custom.origin.x):Math.PI;
  sprite(p,neutral,'flare',34,{life:.08});scatter(p,neutral,['spark'],{count:9,direction,spread:1.1,gravity:150,life:[.1,.25]});
  if(custom.shield>0)effect(p,deck,'shield',custom);
 }
 function bossCue(p,shield=false){
  if(!init())return;resize();const c={palette:monochrome?['#bdbdbd','#777777','#ffffff']:colors.physical,size:1,speed:1,angle:0,spread:1,skill:skillModifiers[0]};
  if(shield)orbit(p,c,'chip',4,58,{size:30,life:.6,vx:0,vy:0});
  else scatter(p,c,['dust'],{count:6,radius:18,speed:[5,20],life:[.2,.4],gravity:0,alpha:[.1,.25]});
 }
 function markers(list){
  if(!list.length){ambient=[];if(canvas)render();return}if(!init())return;resize();ambient=[];
  for(const item of list.slice(0,80)){const c=config(item.deck,item);if(!c)continue;ambient.push({x:item.x,y:item.y,rotation:item.rotation||0,texture:item.texture||'motes',tile:index[item.texture||'motes'],color:rgb(c.palette[0]),size:item.size||18,aspect:item.aspect||1,alpha:item.alpha||.3,blend:'add',persistent:true,age:0,life:1,fade:0,grow:0,shrink:0})}wake();
 }
 function support(p,deck,tier=0,custom={}){effect(p,deck,custom.kind||'buff',{...custom,tier})}
 function muzzle(p,deck='bullet',custom={}){if(!init())return;const c=config(deck,custom);if(!c)return;sprite(p,c,'flare',30,{life:.06});scatter(p,c,['spark','chip'],{count:7,spread:.4,life:[.08,.15],gravity:140})}
 function passive(p,deck,tier=0,custom={}){effect(p,deck,'buff',{...custom,tier})}
 function hit(p,deck,tier=0,custom={}){contact(p,deck,tier,custom)}

 function tick(now){
  frame=0;if(paused||document.hidden)return;const start=performance.now(),rawDT=last?(now-last)/1000:1/60,dt=Math.min(rawDT,.05);last=now;clock+=dt;
  while(events.length&&events[0].at<=clock){events.shift().fn()}
  for(let i=active.length-1;i>=0;i--){const p=active[i];p.age+=dt;if(p.age>=p.life){free.push(p);active[i]=active[active.length-1];active.pop();continue}
   if(p.attract){const dx=p.tx-p.x,dy=p.ty-p.y,d=Math.hypot(dx,dy)||1;p.vx+=dx/d*p.attract*dt;p.vy+=dy/d*p.attract*dt}
   p.vx+=(p.ax+Math.sin(p.age*8+p.x*.01)*p.turbulence)*dt;p.vy+=(p.ay+Math.cos(p.age*7+p.y*.01)*p.turbulence*.4)*dt;const drag=Math.exp(-p.drag*dt);p.vx*=drag;p.vy*=drag;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rotation+=p.spin*dt;
   if(p.trail&&active.length<limit*.82&&(p.trailClock+=dt)>.035){p.trailClock=0;particle({x:p.x,y:p.y,texture:p.texture,color:p.color,size:p.size*.7,aspect:p.aspect,rotation:p.rotation,life:p.trail,alpha:p.alpha*.25,fade:.003,shrink:1,depth:p.depth});}
   if(p.x<-300||p.y<-400||p.x>width+300||p.y>height+300){free.push(p);active[i]=active[active.length-1];active.pop()}
  }
  render();metrics.frames++;metrics.cpu.push(performance.now()-start);metrics.dt.push(rawDT*1000);if(metrics.cpu.length>240){metrics.cpu.shift();metrics.dt.shift()}
  if(active.length||events.length||ambient.length)wake();else last=0;
 }
 function appearance(p){if(p.persistent)return {a:p.alpha*(.8+.2*Math.sin(clock*2+p.x*.01)),s:p.size};const t=p.age/p.life;return {a:p.alpha*clamp(p.age/Math.max(.002,p.fade))*Math.pow(1-t,1.15),s:p.size*(1+p.grow*t)*(1-p.shrink*t*.55)*(1+(p.stretch||0)*Math.sin(t*Math.PI))}}
 function render(){
  if(gl){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bindTexture(gl.TEXTURE_2D,texture);metrics.drawCalls=0;
   for(const depth of [0,1,2])for(const blend of ['normal','add']){let count=0;for(const p of [...active,...ambient]){if(p.blend!==blend||(p.depth??1)!==depth)continue;const {a,s}=appearance(p),cs=Math.cos(p.rotation),sn=Math.sin(p.rotation),tx=(p.tile%4)*.25,ty=(p.tile>>2)*.25;
    for(const[qx,qy,u,v]of QUAD){const x=qx*s,y=qy*s*p.aspect,k=count*8;vertexData[k]=p.x+x*cs-y*sn;vertexData[k+1]=p.y+x*sn+y*cs;vertexData[k+2]=tx+.001+u*.248;vertexData[k+3]=ty+.001+v*.248;vertexData[k+4]=p.color[0];vertexData[k+5]=p.color[1];vertexData[k+6]=p.color[2];vertexData[k+7]=a;count++}
   }if(count){gl.blendFunc(gl.ONE,blend==='add'?gl.ONE:gl.ONE_MINUS_SRC_ALPHA);gl.bufferSubData(gl.ARRAY_BUFFER,0,vertexData.subarray(0,count*8));gl.drawArrays(gl.TRIANGLES,0,count);metrics.drawCalls++}}
  }else if(ctx){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);ctx.save();for(const r of protectedRects){ctx.beginPath();ctx.rect(0,0,width,height);ctx.rect(r[0],r[1],r[2]-r[0],r[3]-r[1]);ctx.clip('evenodd')}for(const p of [...active,...ambient].sort((a,b)=>(a.depth??1)-(b.depth??1)||(a.blend==='add')-(b.blend==='add'))){const {a,s}=appearance(p);ctx.save();ctx.globalCompositeOperation=p.blend==='add'?'lighter':'source-over';ctx.globalAlpha=a;ctx.translate(p.x,p.y);ctx.rotate(p.rotation);ctx.drawImage(tintedTile(p),-s/2,-s*p.aspect/2,s,s*p.aspect);ctx.restore()}ctx.restore()}
 }
 function clear(){for(const a of shakes)a.cancel();shakes.clear();if(frame)cancelAnimationFrame(frame);frame=0;last=0;events.length=0;ambient=[];while(active.length)free.push(active.pop());if(canvas)render()}
 function pause(){paused=true;if(frame)cancelAnimationFrame(frame);frame=0;last=0}
 function resume(){paused=false;last=0;wake()}
 function stats(){const sorted=metrics.dt.slice().sort((a,b)=>a-b);return{renderer:gl?'WebGL':ctx?'Canvas2D':'not-started',quality,scale,limit,active:active.length,pooled:free.length,pending:events.length,peak:metrics.peak,spawned:metrics.spawned,dropped:metrics.dropped,drawCalls:metrics.drawCalls,frames:metrics.frames,meanCPUms:+(metrics.cpu.reduce((a,b)=>a+b,0)/(metrics.cpu.length||1)).toFixed(2),p95FrameMs:+(sorted[Math.floor(sorted.length*.95)]||0).toFixed(2),protectedRects:protectedRects.length,markers:ambient.length,contacts:effectMetrics.contacts,byDeck:{...effectMetrics.byDeck},byActor:{...effectMetrics.byActor},kinds:{...effectMetrics.kinds}}}
 function resetMetrics(){effectMetrics.contacts=0;effectMetrics.byDeck={};effectMetrics.byActor={};effectMetrics.kinds={};metrics.spawned=metrics.dropped=metrics.peak=metrics.frames=metrics.bursts=0;metrics.cpu.length=metrics.dt.length=0}
 window.addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',()=>{if(document.hidden)clear()});
 window.ParticleVFX={begin,hit,contact,incoming,bossCue,effect,transfer,markers,presets,characterModifiers,skillModifiers,setMonochrome:value=>{monochrome=!!value},support,muzzle,passive,clear,resize,setQuality,stats,pause,resume,resetMetrics,config,emit:(p,o)=>{if(init())emit(p,o)},types};
})();
