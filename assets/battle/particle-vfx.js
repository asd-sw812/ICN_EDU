/* Independent, pooled, batched WebGL sprite VFX. Does not read or mutate combat state. */
(()=>{
 'use strict';
 const TAU=Math.PI*2,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),rand=(a,b)=>a+Math.random()*(b-a);
 const types=['glow','flare','spark','chip','smoke','flame','ember','crystal','dust','wave','slash','arc','wisp','energy','motes','ring'];
 const QUAD=[[-.5,-.5,0,0],[.5,-.5,1,0],[.5,.5,1,1],[-.5,-.5,0,0],[.5,.5,1,1],[-.5,.5,0,1]];
 const index=Object.fromEntries(types.map((t,i)=>[t,i]));
 const colors={physical:['#ffd9a0','#ff9554','#fff0cd'],slash:['#c0e9ff','#6d9fe8','#f2f5ff'],fire:['#ff732c','#ffd276','#ef4526'],ice:['#a8f4ff','#588ed5','#e9ffff'],electric:['#d0c3ff','#78b9ff','#fff7c9'],poison:['#b4d969','#6c9881','#d1b4e8'],magic:['#cbb2ff','#829fee','#f4deff'],heal:['#a9e5b2','#72b9b0','#f5ebc3']};
 const deckTypes={bullet:'physical',counter:'physical',follow:'slash',speed:'slash',execute:'slash',crit:'physical',bleed:'slash',poison:'poison',freeze:'ice',burn:'fire',electric:'electric',wave:'ice',tree:'poison',wind:'slash',radiance:'magic',lifesteal:'magic',bounce:'magic',debuff:'poison',skill:'magic',ult:'magic',hp:'heal',cleanse:'heal',enhance:'magic',defense:'physical'};
 const overrides={bleed:['#ff9d98','#d86a85','#ffe0d7'],wave:['#70cbdc','#88aeee','#d7f3ff'],tree:['#9fd699','#5da98a','#e6edb2'],radiance:['#ffdf9d','#cfb089','#fff5d5'],lifesteal:['#cf8ebf','#c35c80','#f4c7db'],wind:['#9ee6cf','#76b9c9','#ddfff3']};
 let canvas=null,root=null,gl=null,ctx=null,program=null,buffer=null,texture=null,atlas=null,failedGL=false,frame=0,last=0,clock=0,paused=false;
 let width=1,height=1,pixelRatio=1,quality='auto',scale=1,limit=900,active=[],free=[],events=[],eventId=0,protectedRects=[];
 const CAP=1400,vertexData=new Float32Array(CAP*6*8),gpuRects=new Float32Array(8*4),metrics={spawned:0,dropped:0,peak:0,frames:0,cpu:[],dt:[],drawCalls:0,bursts:0};
 const rgb=hex=>{const n=parseInt(hex.slice(1),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]};
 function hash(x,y){const n=Math.sin(x*127.1+y*311.7)*43758.5453123;return n-Math.floor(n)}
 function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return(hash(ix,iy)*(1-u)+hash(ix+1,iy)*u)*(1-v)+(hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u)*v}
 function fbm(x,y){return noise(x,y)*.57+noise(x*2.1+3,y*2.1)*.28+noise(x*4.2,y*4.2+7)*.15}
 function segment(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy)}
 function makeAtlas(){
  const c=document.createElement('canvas');c.width=c.height=512;const cx=c.getContext('2d'),im=cx.createImageData(512,512),data=im.data;
  const arcs=[[-.88,-.16],[-.61,.15],[-.41,-.06],[-.13,.28],[.03,-.10],[.27,.09],[.47,-.2],[.88,.02]];
  for(let tile=0;tile<16;tile++)for(let j=0;j<128;j++)for(let i=0;i<128;i++){
   const x=(i-63.5)/63.5,y=(j-63.5)/63.5,r=Math.hypot(x,y),n=fbm(x*4.5+tile*11,y*4.5),grain=hash(i+tile*47,j),edge=clamp((.97-Math.max(Math.abs(x),Math.abs(y)))*18);let a=0,l=.85;
   switch(types[tile]){
    case'glow':a=Math.exp(-r*r*6)*clamp((1-r)*4);l=.65+.35*Math.exp(-r*r*24);break;
    case'flare':a=clamp(Math.exp(-r*r*18)*.8+Math.exp(-x*x*180-y*y*4)*.55+Math.exp(-y*y*150-x*x*7)*.8)*(1-r*.5);l=1;break;
    case'spark':{const bend=.065*Math.sin(x*10);a=Math.exp(-Math.pow((y-bend)/(.035+.045*(1-x)),2))*clamp((1-Math.abs(x))*4);a+=Math.exp(-y*y*90-x*x*3)*.17;l=.7+.3*(1-Math.abs(x));break;}
    case'chip':{const shape=1-Math.abs(x+.15*y)/.50-Math.abs(y)/.83;a=clamp(shape*30)*(.75+.25*n);l=x>y*.4?.92:.43;break;}
    case'smoke':a=Math.pow(clamp((n-.24)*1.8),1.4)*Math.exp(-r*r*3.1)*.52;l=.45+.5*n;break;
    case'flame':{const yy=(y+1)*.5,bend=.18*Math.sin(y*7+n*2),spread=.1+yy*.55;a=clamp((1-Math.abs(x-bend)/spread)*2)*Math.pow(clamp(1-Math.abs(y)*1.04),.65)*(.25+.75*n);l=.45+.55*Math.exp(-x*x*20)*yy;break;}
    case'ember':a=Math.exp(-x*x*110-y*y*20)*(.7+.3*n)+Math.exp(-r*r*16)*.12;l=1;break;
    case'crystal':{const shape=1-Math.abs(x+.20*y)/.38-Math.abs(y)/.95;a=clamp(shape*36);l=x<0?.45+.35*n:Math.abs(x-y*.1)<.08?1:.88;break;}
    case'dust':a=Math.exp(-r*r*8)*Math.pow(n,2)*.6;l=.6+.4*grain;break;
    case'wave':case'ring':{const rr=r+Math.sin(Math.atan2(y,x)*7)*.025+(n-.5)*.06;const band=Math.exp(-Math.pow((rr-.64)/.07,2));a=band*(.35+.65*n)+Math.exp(-Math.pow((rr-.61)/.025,2))*.25;l=.72+.28*n;break;}
    case'slash':{const curve=.55*x*x-.33,width=.024+.073*clamp(1-x*x);a=Math.exp(-Math.pow((y-curve)/width,2))*Math.pow(clamp(1-x*x),.6)*(.45+.55*n);a+=Math.exp(-Math.pow((y-curve)/(.13+width),2))*.13*clamp(1-x*x);l=.78+.22*n;break;}
    case'arc':{let d=9;for(let z=0;z<arcs.length-1;z++)d=Math.min(d,segment(x,y,arcs[z],arcs[z+1]));for(let z=1;z<6;z+=2)d=Math.min(d,segment(x,y,arcs[z],[arcs[z][0]+.12,arcs[z][1]-.36]));a=Math.exp(-d*d*2800)+Math.exp(-d*d*130)*.24;l=1;break;}
    case'wisp':{const curve=.3*Math.sin(y*4.2+n*.7);a=Math.exp(-Math.pow((x-curve)/.21,2))*clamp(1-y*y)*n*.8;l=.7+.3*n;break;}
    case'energy':{const shape=1-Math.abs(x)/.55-Math.abs(y+.15*x)/.80;a=clamp(shape*9)*(.3+.7*n)+Math.exp(-r*r*8)*.12;l=.6+.4*n;break;}
    case'motes':a=clamp((grain-.91)*13)*Math.exp(-r*r*3)+Math.exp(-r*r*14)*.1;l=1;break;
   }
   const k=(((tile>>2)*128+j)*512+(tile%4)*128+i)*4;data[k]=data[k+1]=data[k+2]=Math.round(clamp(l)*255);data[k+3]=Math.round(clamp(a*edge)*255);
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
  canvas.width=Math.max(1,Math.round(r.width*pixelRatio));canvas.height=Math.max(1,Math.round(r.height*pixelRatio));
  protectedRects=[];for(const selector of ['#skillPanel','.skill-detail','.party-grid','.turn-order','.fighter-label','.boss-card','.raid-hud','header .actions']){const el=document.querySelector(selector);if(!el)continue;const q=el.getBoundingClientRect();if(q.width&&q.height)protectedRects.push([(q.left-r.left)*width/(r.width||1),(q.top-r.top)*height/(r.height||1),(q.right-r.left)*width/(r.width||1),(q.bottom-r.top)*height/(r.height||1)])}
  gpuRects.fill(-9999);protectedRects.slice(0,8).forEach((a,i)=>gpuRects.set(a,i*4));
  if(gl){gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);gl.uniform2f(gl.getUniformLocation(program,'size'),width,height);gl.uniform4fv(gl.getUniformLocation(program,'ui[0]'),gpuRects);gl.uniform1i(gl.getUniformLocation(program,'atlas'),0)}
 }
 function wake(){if(!frame&&!paused&&!document.hidden){frame=requestAnimationFrame(tick)}}
 function schedule(delay,fn){events.push({at:clock+Math.max(0,delay),fn,id:++eventId});events.sort((a,b)=>a.at-b.at||a.id-b.id);wake()}
 function particle(spec){
  if(active.length>=limit){metrics.dropped++;return}const p=free.pop()||{};
  Object.assign(p,{x:0,y:0,vx:0,vy:0,ax:0,ay:0,drag:0,age:0,life:.5,size:16,aspect:1,rotation:0,spin:0,alpha:1,fade:.08,grow:0,shrink:.5,texture:'spark',blend:'add',color:[1,1,1],attract:0,tx:0,ty:0,turbulence:0},spec);
  p.tile=index[p.texture]??0;active.push(p);metrics.spawned++;metrics.peak=Math.max(metrics.peak,active.length);wake();
 }
 function emit(p,options={}){
  const o={count:30,textures:['spark','chip','dust'],palette:colors.physical,speed:[90,340],size:[8,24],life:[.25,.7],spread:TAU,direction:0,radius:6,gravity:180,drag:1.8,alpha:[.6,1],grow:0,blend:'add',...options};
  const count=Math.max(1,Math.round(o.count*scale));for(let i=0;i<count;i++){
   const a=o.direction+rand(-o.spread/2,o.spread/2),speed=rand(...o.speed),r=rand(0,o.radius),j=rand(0,TAU),texture=o.textures[Math.floor(Math.random()*o.textures.length)];
   particle({x:p.x+Math.cos(j)*r,y:p.y+Math.sin(j)*r,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,ay:o.gravity,drag:rand(o.drag*.65,o.drag*1.35),life:rand(...o.life),size:rand(...o.size),aspect:texture==='spark'?rand(.4,.8):rand(.6,1.3),rotation:a+rand(-.8,.8),spin:rand(-5,5),alpha:rand(...o.alpha),color:rgb(o.palette[Math.floor(Math.random()*o.palette.length)]),texture,blend:o.blend,grow:o.grow,shrink:o.shrink??.65,turbulence:o.turbulence||0,attract:o.attract||0,tx:p.x,ty:p.y,...o.particle});
  }
 }
 function glow(p,palette,power=1,duration=.20){particle({x:p.x,y:p.y,texture:'glow',color:rgb(palette[0]),size:150*power,life:duration,alpha:.55,fade:.012,grow:.8,shrink:0});particle({x:p.x,y:p.y,texture:'flare',color:rgb(palette[2]),size:75*power,life:.065,alpha:.95,fade:.003,grow:.35,shrink:0})}
 function shock(p,palette,power=1,delay=.03){schedule(delay,()=>particle({x:p.x,y:p.y,texture:'wave',color:rgb(palette[0]),size:95*power,life:.4,alpha:.55,rotation:rand(0,TAU),fade:.012,grow:2.7,shrink:0,aspect:.8}))}
 function config(deck,custom={}){const type=deckTypes[deck]||'magic';return{type,palette:overrides[deck]||colors[type],count:70,size:[8,26],speed:[100,360],life:[.25,.75],glow:1,shock:1,shake:1,timing:{residue:.16},...custom}}
 function begin(p,deck,tier,windup,custom={}){
  if(!init())return;resize();const cfg=config(deck,custom),duration=windup/1000;
  if(tier===2){
   // Several gathering pulses, increasing density, then a short quiet interval before contact.
   for(let i=0;i<4;i++)schedule(duration*(i*.17),()=>{emit(p,{count:18+i*13,textures:['energy','motes','wisp'],palette:cfg.palette,radius:105+i*12,speed:[5,25],life:[Math.max(.13,duration*(1-i*.17)),Math.max(.18,duration*(1-i*.17)+.08)],size:[8,22],gravity:0,drag:.8,attract:320,turbulence:5,particle:{shrink:.8}})});
   schedule(duration*.55,()=>particle({x:p.x,y:p.y,texture:'glow',size:150,life:Math.max(.08,duration*.32),color:rgb(cfg.palette[0]),alpha:.6,grow:-.6,shrink:0}));
  }else if(cfg.type==='magic')emit(p,{count:18,textures:['energy','dust'],palette:cfg.palette,radius:75,speed:[0,20],life:[duration*.8,duration+.04],size:[7,19],gravity:0,attract:230,drag:.5});
  else emit(p,{count:7,textures:['motes','dust'],palette:cfg.palette,radius:18,speed:[10,45],life:[.16,.32],size:[9,20],gravity:-15,alpha:[.2,.45]});
 }
 function shake(target,strength,duration=180){
  if(!target||matchMedia('(prefers-reduced-motion:reduce)').matches||quality==='low')return;
  const anim=target.animate([{translate:'0px 0px'},{translate:`${-strength}px ${strength*.35}px`,offset:.2},{translate:`${strength*.65}px ${-strength*.25}px`,offset:.45},{translate:`${-strength*.25}px 0px`,offset:.7},{translate:'0px 0px'}],{duration,fill:'none'});anim.onfinish=()=>anim.cancel();
 }
 function hit(p,deck,tier=0,custom={}){
  if(!init())return;resize();metrics.bursts++;const c=config(deck,custom),power=1+tier*.22,palette=c.palette,common={palette,count:c.count,size:c.size,speed:c.speed,life:c.life};
  glow(p,palette,power*c.glow);shock(p,palette,power*c.shock);
  switch(c.type){
   case'physical':emit(p,{...common,textures:['spark','chip','ember'],count:tier?95:58,direction:-Math.PI*.25,spread:TAU,speed:[150,480],gravity:300,drag:3,life:[.13,.48]});schedule(.08,()=>emit(p,{count:12,textures:['smoke','dust'],palette,radius:13,size:[30,60],speed:[15,65],gravity:-35,life:[.35,.65],blend:'normal',alpha:[.08,.2],grow:.5}));break;
   case'slash':{
    const angle=custom.angle??-.55;for(let i=0;i<3;i++)schedule(i*.035,()=>particle({x:p.x-28+i*20,y:p.y,texture:'slash',rotation:angle,size:330,aspect:.7,life:.16+i*.07,alpha:.8-i*.2,color:rgb(palette[i]),vx:120,vy:-55,drag:4,grow:.2,shrink:0}));
    emit(p,{...common,textures:['energy','spark','chip'],count:75,direction:angle,spread:Math.PI*1.6,speed:[110,400],gravity:130});schedule(.12,()=>emit(p,{count:18,textures:['motes','wisp'],palette,radius:55,speed:[10,50],life:[.35,.65],size:[12,28],gravity:-20,alpha:[.15,.4]}));break;
   }
   case'fire':emit(p,{...common,count:65,textures:['flame','ember'],speed:[65,220],size:[22,65],life:[.28,.75],gravity:-90,drag:1.8,particle:{rotation:0,spin:rand(-1,1)}});schedule(.06,()=>emit(p,{count:45,textures:['ember','spark'],palette,speed:[120,370],size:[7,17],life:[.65,1.4],gravity:120,drag:1.6}));schedule(.14,()=>emit(p,{count:16,textures:['smoke','wisp'],palette:['#68646c','#78666c','#9c7f6c'],speed:[25,70],direction:-Math.PI/2,spread:1.8,size:[65,110],life:[.6,1.25],gravity:-20,blend:'normal',alpha:[.12,.22],grow:.65}));break;
   case'ice':emit(p,{...common,count:66,textures:['crystal','chip'],speed:[120,330],size:[14,42],life:[.45,1.05],gravity:280,drag:.8});schedule(.035,()=>emit(p,{count:27,textures:['flare','motes','dust'],palette,radius:35,size:[7,19],life:[.15,.55],speed:[50,170],gravity:20}));schedule(.16,()=>emit(p,{count:8,textures:['smoke'],palette,radius:35,size:[60,95],life:[.35,.65],speed:[10,40],gravity:-15,alpha:[.08,.16],blend:'normal',grow:.5}));break;
   case'electric':for(let i=0;i<5+tier;i++)schedule(i*.021,()=>particle({x:p.x+rand(-50,50),y:p.y+rand(-60,60),texture:'arc',rotation:rand(0,TAU),size:rand(110,210),aspect:rand(.5,.9),life:rand(.055,.13),alpha:.9,color:rgb(palette[i%3]),grow:.15,shrink:0}));emit(p,{...common,count:88,textures:['spark','energy','ember'],speed:[190,480],size:[7,23],life:[.08,.28],gravity:0,drag:4});schedule(.09,()=>glow(p,palette,.6,.08));break;
   case'poison':emit(p,{...common,count:62,textures:['dust','wisp','motes'],radius:45,speed:[10,45],direction:-Math.PI/2,spread:2.5,size:[13,40],life:[.9,2.1],gravity:-18,drag:1.4,turbulence:18,alpha:[.2,.6]});schedule(.09,()=>emit(p,{count:16,textures:['smoke'],palette,radius:40,speed:[5,22],direction:-Math.PI/2,spread:2,size:[60,95],life:[1.0,1.8],gravity:-9,blend:'normal',alpha:[.1,.22],grow:.5}));break;
   case'heal':support(p,deck,tier,custom);break;
   default:emit(p,{...common,count:90,textures:['energy','wisp','motes','spark'],speed:[110,310],gravity:10,drag:2.5,life:[.3,.8]});schedule(.13,()=>emit(p,{count:22,textures:['dust','ember'],palette,radius:50,speed:[10,60],gravity:-20,life:[.7,1.25],alpha:[.2,.55]}));
  }
  if(tier===2){
   // A second detonation and outward aftershock follow the normal contact; this is not a scaled-up single burst.
   schedule(.13,()=>{glow(p,palette,1.55,.25);emit(p,{count:100,textures:['energy','spark','chip','motes'],palette,radius:12,speed:[220,530],size:[9,31],life:[.28,.95],gravity:130,drag:2.4});shock(p,palette,1.65,.025)});
   schedule(.32,()=>{shock(p,palette,1.3,0);emit(p,{count:35,textures:['ember','dust'],palette,radius:90,speed:[10,75],size:[9,23],life:[.7,1.6],gravity:50,drag:1.4});particle({x:p.x,y:p.y,texture:'glow',size:220,life:.65,color:rgb(palette[1]),alpha:.20,grow:.5,shrink:0})});
  }else schedule(c.timing.residue,()=>emit(p,{count:12,textures:['ember','dust'],palette,radius:25,speed:[25,100],life:[.3,.65],size:[5,14],gravity:180,drag:2}));
  shake(document.querySelector(custom.targetSelector||'.boss-figure'),(tier===2?7:3)*c.shake,150);if(tier>0)shake(document.querySelector('.arena'),(tier===2?3.5:1.4)*c.shake,110);
 }
 function support(p,deck,tier=0,custom={}){if(!init())return;resize();const c=config(deck,custom),palette=colors.heal;emit(p,{count:40+tier*12,textures:['wisp','motes','ember'],palette,radius:40,speed:[25,75],direction:-Math.PI/2,spread:1.0,gravity:-20,size:[9,27],life:[.45,1.05],alpha:[.2,.7],drag:.8});particle({x:p.x,y:p.y,texture:'glow',color:rgb(palette[0]),size:125,life:.45,alpha:.25,grow:.5,shrink:0});shock(p,palette,.65)}
 function muzzle(p,deck='bullet'){if(!init())return;const palette=config(deck).palette;glow(p,palette,.48,.09);emit(p,{count:13,textures:['spark','ember'],palette,speed:[60,180],direction:-.3,spread:1.5,life:[.08,.18],size:[7,15],gravity:60,drag:4});schedule(.03,()=>emit(p,{count:4,textures:['smoke'],palette:['#a2a0a0','#99918b','#e0d5bc'],speed:[10,35],direction:-Math.PI/2,spread:1,life:[.24,.4],size:[23,42],gravity:-8,alpha:[.07,.15],blend:'normal',grow:.5}))}
 function passive(p,deck,tier=0){if(!init())return;emit(p,{count:12+tier*7,textures:['dust','energy','motes'],palette:config(deck).palette,radius:10,speed:[30,85],life:[.25,.55],size:[8,19],gravity:-10,alpha:[.25,.65]})}
 function tick(now){
  frame=0;if(paused||document.hidden)return;const start=performance.now(),rawDT=last?(now-last)/1000:1/60,dt=Math.min(rawDT,.05);last=now;clock+=dt;
  while(events.length&&events[0].at<=clock){events.shift().fn()}
  for(let i=active.length-1;i>=0;i--){const p=active[i];p.age+=dt;if(p.age>=p.life){free.push(p);active[i]=active[active.length-1];active.pop();continue}
   if(p.attract){const dx=p.tx-p.x,dy=p.ty-p.y,d=Math.hypot(dx,dy)||1;p.vx+=dx/d*p.attract*dt;p.vy+=dy/d*p.attract*dt}
   p.vx+=(p.ax+Math.sin(p.age*8+p.x*.01)*p.turbulence)*dt;p.vy+=(p.ay+Math.cos(p.age*7+p.y*.01)*p.turbulence*.4)*dt;const drag=Math.exp(-p.drag*dt);p.vx*=drag;p.vy*=drag;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rotation+=p.spin*dt;
   if(p.x<-300||p.y<-400||p.x>width+300||p.y>height+300){free.push(p);active[i]=active[active.length-1];active.pop()}
  }
  render();metrics.frames++;metrics.cpu.push(performance.now()-start);metrics.dt.push(rawDT*1000);if(metrics.cpu.length>240){metrics.cpu.shift();metrics.dt.shift()}
  if(active.length||events.length)wake();else last=0;
 }
 function appearance(p){const t=p.age/p.life;return {a:p.alpha*clamp(p.age/Math.max(.002,p.fade))*Math.pow(1-t,1.15),s:p.size*(1+p.grow*t)*(1-p.shrink*t*.55)}}
 function render(){
  if(gl){gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bindTexture(gl.TEXTURE_2D,texture);metrics.drawCalls=0;
   for(const blend of ['normal','add']){let count=0;for(const p of active){if(p.blend!==blend)continue;const {a,s}=appearance(p),cs=Math.cos(p.rotation),sn=Math.sin(p.rotation),tx=(p.tile%4)*.25,ty=(p.tile>>2)*.25;
    for(const[qx,qy,u,v]of QUAD){const x=qx*s,y=qy*s*p.aspect,k=count*8;vertexData[k]=p.x+x*cs-y*sn;vertexData[k+1]=p.y+x*sn+y*cs;vertexData[k+2]=tx+.001+u*.248;vertexData[k+3]=ty+.001+v*.248;vertexData[k+4]=p.color[0];vertexData[k+5]=p.color[1];vertexData[k+6]=p.color[2];vertexData[k+7]=a;count++}
   }if(count){gl.blendFunc(gl.ONE,blend==='add'?gl.ONE:gl.ONE_MINUS_SRC_ALPHA);gl.bufferSubData(gl.ARRAY_BUFFER,0,vertexData.subarray(0,count*8));gl.drawArrays(gl.TRIANGLES,0,count);metrics.drawCalls++}}
  }else if(ctx){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);ctx.save();for(const r of protectedRects){ctx.beginPath();ctx.rect(0,0,width,height);ctx.rect(r[0],r[1],r[2]-r[0],r[3]-r[1]);ctx.clip('evenodd')}for(const p of active){const {a,s}=appearance(p);ctx.save();ctx.globalCompositeOperation=p.blend==='add'?'lighter':'source-over';ctx.globalAlpha=a;ctx.translate(p.x,p.y);ctx.rotate(p.rotation);ctx.drawImage(atlas,(p.tile%4)*128,(p.tile>>2)*128,128,128,-s/2,-s*p.aspect/2,s,s*p.aspect);ctx.restore()}ctx.restore()}
 }
 function clear(){if(frame)cancelAnimationFrame(frame);frame=0;last=0;events.length=0;while(active.length)free.push(active.pop());if(canvas)render()}
 function pause(){paused=true;if(frame)cancelAnimationFrame(frame);frame=0;last=0}
 function resume(){paused=false;last=0;wake()}
 function stats(){const sorted=metrics.dt.slice().sort((a,b)=>a-b);return{renderer:gl?'WebGL':ctx?'Canvas2D':'not-started',quality,scale,limit,active:active.length,pooled:free.length,pending:events.length,peak:metrics.peak,spawned:metrics.spawned,dropped:metrics.dropped,drawCalls:metrics.drawCalls,frames:metrics.frames,meanCPUms:+(metrics.cpu.reduce((a,b)=>a+b,0)/(metrics.cpu.length||1)).toFixed(2),p95FrameMs:+(sorted[Math.floor(sorted.length*.95)]||0).toFixed(2),protectedRects:protectedRects.length}}
 function resetMetrics(){metrics.spawned=metrics.dropped=metrics.peak=metrics.frames=metrics.bursts=0;metrics.cpu.length=metrics.dt.length=0}
 window.addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',()=>{if(document.hidden)clear()});
 window.ParticleVFX={begin,hit,support,muzzle,passive,clear,resize,setQuality,stats,pause,resume,resetMetrics,config,emit:(p,o)=>{if(init())emit(p,o)},types};
})();
