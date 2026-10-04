/* Cubism 5.3 MOC renderer for the unmasked rear character meshes. */
(()=>{
 const paths={bullet_0:'assets/battle/live2d/bullet_0/bullet_0.model3.json',bullet_1:'assets/battle/live2d/support/bullet_support.model3.json',bullet_2:'assets/battle/live2d/support/bullet_support.model3.json',bullet_3:'assets/battle/live2d/support/bullet_support.model3.json'};
 ["poison_0", "poison_1", "poison_2", "poison_3", "counter_0", "counter_1", "counter_2", "counter_3", "follow_0", "follow_1", "follow_2", "follow_3", "freeze_0", "freeze_1", "freeze_2", "freeze_3", "lifesteal_0", "lifesteal_1", "lifesteal_2", "lifesteal_3", "bounce_0", "bounce_1", "bounce_2", "bounce_3", "hp_0", "hp_1", "hp_2", "hp_3", "speed_0", "speed_1", "speed_2", "speed_3", "debuff_0", "debuff_1", "debuff_2", "debuff_3", "ult_0", "ult_1", "ult_2", "ult_3", "enhance_0", "enhance_1", "enhance_2", "enhance_3", "skill_0", "skill_1", "skill_2", "skill_3", "execute_0", "execute_1", "execute_2", "execute_3", "crit_0", "crit_1", "crit_2", "crit_3", "cleanse_0", "cleanse_1", "cleanse_2", "cleanse_3", "burn_0", "burn_1", "burn_2", "burn_3", "bleed_0", "bleed_1", "bleed_2", "bleed_3", "electric_0", "electric_1", "electric_2", "electric_3", "defense_0", "defense_1", "defense_2", "defense_3", "radiance_0", "radiance_1", "radiance_2", "radiance_3", "wave_0", "wave_1", "wave_2", "wave_3", "tree_0", "tree_1", "tree_2", "tree_3", "wind_0", "wind_1", "wind_2", "wind_3"].forEach(id=>paths[id]=`assets/battle/live2d/rear/${id}.model3.json`);
 let current=null,sequence=0;
 const assets=new Map();
 async function load(id){
  if(assets.has(paths[id])){const cached=assets.get(paths[id]);assets.delete(paths[id]);assets.set(paths[id],cached);return cached}
  const task=(async()=>{
   const C=window.Live2DCubismCore;
   if(!C)throw Error('Cubism Core unavailable');
   for(let i=0;i<80;i++){try{C.Version.csmGetVersion();break}catch(e){if(i===79)throw e;await new Promise(r=>setTimeout(r,100))}}
   const base=new URL(paths[id],document.baseURI);base.searchParams.set('v','motion3');const json=await fetch(base).then(check).then(r=>r.json());
   const data=await fetch(new URL(json.FileReferences.Moc,base)).then(check).then(r=>r.arrayBuffer());
   const moc=C.Moc.fromArrayBuffer(data);if(!moc)throw Error('Invalid MOC3');
   const textures=await Promise.all(json.FileReferences.Textures.map(src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=new URL(src,base)})));
   return {moc,textures,regions:json.MotionRegions||{}};
  })();assets.set(paths[id],task);try{
   const loaded=await task;
   // Keep decoded character atlases bounded while moving between the 24 decks.
   for(const key of [...assets.keys()]){
    if(assets.size<=8)break;
    if(key===paths[id]||key===paths[current?.id])continue;
    const old=assets.get(key);assets.delete(key);
    old.then(asset=>asset.moc._release()).catch(()=>{});
   }
   return loaded;
  }catch(e){assets.delete(paths[id]);throw e}
 }
 function check(r){if(!r.ok)throw Error('Live2D asset '+r.status);return r}
 function dispose(){sequence++;if(!current)return;cancelAnimationFrame(current.frame);current.container.querySelector('.cubism-character')?.remove();current.container.classList.remove('live2d-ready');current.model.release();current.gl.getExtension('WEBGL_lose_context')?.loseContext();current=null}
 function recoil(id){if(current?.id===id)current.recoilAt=performance.now()}
 function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
 async function mount(container,id){
  if(current?.container===container&&current.id===id)return;
  dispose();const ticket=++sequence;if(!container||!paths[id])return;
  try{
   const asset=await load(id);if(ticket!==sequence||!container.isConnected)return;
   const canvas=document.createElement('canvas');canvas.className='cubism-character';canvas.setAttribute('aria-label','Live2D 전투 캐릭터');
   const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true});if(!gl)throw Error('WebGL unavailable');
   const model=Live2DCubismCore.Model.fromMoc(asset.moc);if(!model)throw Error('MOC initialization failed');
   if(Array.from(model.drawables.maskCounts).some(Boolean)){model.release();throw Error('This renderer requires unmasked meshes')}
   const program=gl.createProgram();
   gl.attachShader(program,shader(gl,gl.VERTEX_SHADER,'attribute vec2 p;attribute vec2 uv;uniform vec2 scale;varying vec2 tex;void main(){gl_Position=vec4(p*scale,0.,1.);tex=vec2(uv.x,1.-uv.y);}'));
   gl.attachShader(program,shader(gl,gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D image;uniform float opacity;varying vec2 tex;void main(){gl_FragColor=texture2D(image,tex)*opacity;}'));
   gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
   const p=gl.getAttribLocation(program,'p'),uv=gl.getAttribLocation(program,'uv'),scale=gl.getUniformLocation(program,'scale'),opacity=gl.getUniformLocation(program,'opacity');
   const textures=asset.textures.map(im=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t});
   const d=model.drawables,buffers=d.ids.map((_,i)=>{const pos=gl.createBuffer(),tex=gl.createBuffer(),ind=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,tex);gl.bufferData(gl.ARRAY_BUFFER,d.vertexUvs[i],gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ind);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,d.indices[i],gl.STATIC_DRAW);return {pos,tex,ind,warp:new Float32Array(d.vertexPositions[i].length)}});
   const indices=['ParamAngleX','ParamAngleY','ParamAngleZ'].map(id=>model.parameters.ids.indexOf(id));
   const phase=Array.from(id).reduce((n,c)=>n+c.charCodeAt(0),0)*.13;
   const run={id,container,model,gl,frame:0,recoilAt:-Infinity,lastTime:0,phase,ticks:0,springs:[{value:0,velocity:0},{value:0,velocity:0},{value:0,velocity:0}]};current=run;container.append(canvas);container.classList.add('live2d-ready');container.dataset.live2d=id;
   gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
   const draw=now=>{
    if(current!==run)return;if(!container.isConnected){dispose();return}
    const rect=container.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(rect.width*ratio)),h=Math.max(1,Math.round(rect.height*ratio));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    const reduced=document.body.classList.contains('character-motion-off');
    const gentle=(document.body.classList.contains('vfx-reduced')||matchMedia('(prefers-reduced-motion:reduce)').matches)?0.65:1;
    const t=now/1000,preparing=container.closest('.active-fighter')?.classList.contains('preparing');
    const shot=(now-run.recoilAt)/420,firing=shot>=0&&shot<1;
    const layered=d.ids.includes('Rear_Body');
    const dt=Math.min(Math.max((now-run.lastTime)/1000,0),1/30);run.lastTime=now;
    const breath=Math.sin(t*1.35+phase),sway=Math.sin(t*.78+phase);
    const kick=firing?Math.sin(shot*Math.PI)*14:0;
    // Drive the exported Cubism cloth/body/hair keyforms with separate damped responses.
    const targets=layered?[gentle*(sway*14+breath*3)+kick, gentle*breath*17-kick*.45,gentle*(Math.sin(t*1.02+phase+.8)*19+sway*3)-kick*.6]:[gentle*(sway*9)+(firing?kick*1.6:preparing?6:0),gentle*breath*17,gentle*Math.sin(t*1.02+phase+.8)*17];
    const stiffness=[30,22,18],damping=[8,9,6.5];
    const values=run.springs.map((spring,i)=>{
     if(reduced){spring.value=0;spring.velocity=0;return 0}
     spring.velocity+=(stiffness[i]*(targets[i]-spring.value)-damping[i]*spring.velocity)*dt;
     spring.value=Math.max(-30,Math.min(30,spring.value+spring.velocity*dt));return spring.value;
    });
    indices.forEach((index,i)=>{if(index>=0)model.parameters.values[index]=values[i]});model.update();
    const info=model.canvasinfo,mw=info.CanvasWidth/info.PixelsPerUnit,mh=info.CanvasHeight/info.PixelsPerUnit,fit=Math.min(w/mw,h/mh)*.98;
    const pixel=ratio/fit,bodyLift=reduced?0:breath*1.8*gentle*pixel;
    if(++run.ticks%20===0){container.dataset.motionFrame=String(run.ticks);container.dataset.motionState=reduced?'reduced':'running'}
    gl.uniform2f(scale,2*fit/w,2*fit/h);gl.uniform1i(gl.getUniformLocation(program,'image'),0);
    [...d.ids.keys()].sort((a,b)=>layered?(['Rear_Body','Rear_Cloth','Rear_Hair'].indexOf(d.ids[a])-['Rear_Body','Rear_Cloth','Rear_Hair'].indexOf(d.ids[b])):model.renderOrders[a]-model.renderOrders[b]).forEach(i=>{
     if(!d.opacities[i]||(!layered&&id!=='bullet_0'&&!d.ids[i].startsWith(id+'_')))return;const b=buffers[i];b.warp.set(d.vertexPositions[i]);
     const region=asset.regions[d.ids[i]];
     // Pin the top of each visible part and bend its free end in screen pixels.
     // This secondary mesh deformation supplements the exported Cubism keyforms.
     if(region&&!reduced)for(let v=0;v<b.warp.length;v+=2){
      const x=b.warp[v],y=b.warp[v+1],weight=Math.pow(Math.max(0,Math.min(1,(region.Top-y)/Math.max(.02,region.Top-region.Bottom))),1.6);
      const sign=d.ids[i].includes('Left')?-1:1;
      if(region.Kind==='hair'){const pinned=layered?weight:Math.pow(1-Math.max(0,Math.min(1,(region.Top-y)/Math.max(.02,region.Top-region.Bottom))),1.6);b.warp[v]+=Math.sin(t*1.02+phase+.8)*3.2*gentle*pixel*pinned;b.warp[v+1]+=Math.sin(t*1.35+phase+1)*.7*gentle*pixel*pinned}
      if(region.Kind==='cloth'){b.warp[v]+=Math.sin(t*.88+phase+sign*.8)*(layered?2.8:4.8)*gentle*pixel*weight;b.warp[v+1]+=Math.cos(t*.88+phase)*.8*gentle*pixel*weight}
      b.warp[v]+=(x-region.CenterX)*Math.sin(t*.78+phase)*.004*gentle;
      b.warp[v+1]+=bodyLift;
     }
     gl.bindBuffer(gl.ARRAY_BUFFER,b.pos);gl.bufferData(gl.ARRAY_BUFFER,b.warp,gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
     gl.bindBuffer(gl.ARRAY_BUFFER,b.tex);gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b.ind);gl.bindTexture(gl.TEXTURE_2D,textures[d.textureIndices[i]]);gl.uniform1f(opacity,d.opacities[i]);gl.drawElements(gl.TRIANGLES,d.indices[i].length,gl.UNSIGNED_SHORT,0);
    });d.resetDynamicFlags();run.frame=requestAnimationFrame(draw);
   };run.frame=requestAnimationFrame(draw);
  }catch(e){console.warn('Live2D loading failed; rear illustration retained.',e);container?.classList.remove('live2d-ready')}
 }
 window.BattleLive2D={mount,dispose,recoil,paths};
})();
