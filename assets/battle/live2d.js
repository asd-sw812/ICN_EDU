/* Cubism surface with continuous regional weights. No rectangular part cut-outs. */
(()=>{
 const VERSION='connected5',cache=new Map();let current=null,sequence=0,pendingPose=null;
 async function checked(url){const r=await fetch(url);if(!r.ok)throw Error('Character asset '+r.status);return r}
 async function load(id){
  if(cache.has(id)){const a=cache.get(id);cache.delete(id);cache.set(id,a);return a}
  const pending=(async()=>{
   const C=window.Live2DCubismCore;if(!C)throw Error('Cubism Core unavailable');
   for(let i=0;i<80;i++){try{C.Version.csmGetVersion();break}catch(e){if(i===79)throw e;await new Promise(r=>setTimeout(r,100))}}
   const config=await checked(new URL('assets/battle/rigs/'+id+'.json?v='+VERSION,document.baseURI)).then(r=>r.json());
   const data=await checked(new URL(config.Moc,document.baseURI)).then(r=>r.arrayBuffer());
   const moc=C.Moc.fromArrayBuffer(data);if(!moc)throw Error('Invalid Cubism surface');
   try{const image=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=new URL(config.Texture+'?v='+VERSION,document.baseURI)});return {moc,image,config}}
   catch(e){moc._release();throw e}
  })();cache.set(id,pending);
  try{const value=await pending;for(const key of [...cache.keys()]){if(cache.size<=8)break;if(key===id||key===current?.id)continue;const old=cache.get(key);cache.delete(key);old.then(a=>a.moc._release()).catch(()=>{})}return value}
  catch(e){cache.delete(id);throw e}
 }
 function dispose(){sequence++;if(!current)return;cancelAnimationFrame(current.frame);current.canvas.remove();current.container.classList.remove('live2d-ready');current.model.release();current.gl.getExtension('WEBGL_lose_context')?.loseContext();current=null}
 function perform(id,options){pendingPose={id,...options,start:performance.now()/1000};if(current?.id===id)current.action=pendingPose}
 function recoil(id){perform(id,{type:'shot',windup:0,total:550,strength:1})}
 function anchor(id,name='hand'){
  if(current?.id!==id)return null;const run=current,p=run.profile;
  const uv=name==='muzzle'?(p.muzzle||[.78,.22]):p.arms[1][1];
  const a=new Float32Array([uv[0]-.5,(.5-uv[1])*run.aspect]),out=new Float32Array(2);
  window.ConnectedRig.deform(a,out,run.aspect,p,performance.now()/1000,run.phase,run.action,1);
  const r=run.container.getBoundingClientRect(),fit=Math.min(r.width,r.height/run.aspect)*.97;
  return {x:r.left+r.width/2+out[0]*fit,y:r.top+r.height/2-out[1]*fit};
 }
 function shader(gl,type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
 async function mount(container,id){
  if(current?.container===container&&current.id===id)return;
  dispose();if(!container||!id)return;const ticket=++sequence;
  try{
   const asset=await load(id);if(ticket!==sequence||!container.isConnected)return;
   const model=Live2DCubismCore.Model.fromMoc(asset.moc);model.parameters.values.set(model.parameters.defaultValues);model.update();
   const d=model.drawables,index=d.ids.indexOf('Rear_Body');if(index<0){model.release();throw Error('Connected Cubism surface missing')}
   const rig=window.ConnectedRig,mesh=rig.subdivide(d.vertexPositions[index],d.indices[index],2);
   const info=model.canvasinfo,aspect=info.CanvasHeight/info.CanvasWidth,mw=info.CanvasWidth/info.PixelsPerUnit;
   const base=mesh.positions;for(let i=0;i<base.length;i++)base[i]/=mw;
   const uvs=new Float32Array(base.length),out=new Float32Array(base.length);
   for(let i=0;i<base.length;i+=2){uvs[i]=base[i]+.5;uvs[i+1]=.5-base[i+1]/aspect}
   const canvas=document.createElement('canvas');canvas.className='cubism-character';canvas.setAttribute('aria-label','전투 캐릭터');
   const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true});if(!gl){model.release();throw Error('WebGL unavailable')}
   const program=gl.createProgram();gl.attachShader(program,shader(gl,gl.VERTEX_SHADER,'attribute vec2 p;attribute vec2 uv;uniform vec2 scale;varying vec2 tex;void main(){gl_Position=vec4(p*scale,0.,1.);tex=uv;}'));
   gl.attachShader(program,shader(gl,gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D image;varying vec2 tex;void main(){if(tex.x<0.||tex.x>1.||tex.y<0.||tex.y>1.)discard;gl_FragColor=texture2D(image,tex);}'));
   gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS)){model.release();throw Error(gl.getProgramInfoLog(program))}gl.useProgram(program);
   const p=gl.getAttribLocation(program,'p'),uv=gl.getAttribLocation(program,'uv'),scale=gl.getUniformLocation(program,'scale');
   const pos=gl.createBuffer(),tex=gl.createBuffer(),ind=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,tex);gl.bufferData(gl.ARRAY_BUFFER,uvs,gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ind);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,mesh.indices,gl.STATIC_DRAW);
   const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,asset.image);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   const phase=Array.from(id).reduce((n,c)=>n+c.charCodeAt(0),0)*.13,profile=asset.config.Weights;
   const action=pendingPose?.id===id&&performance.now()/1000<pendingPose.start+pendingPose.total/1000?pendingPose:null;
   const run={id,container,canvas,model,gl,frame:0,action,aspect,profile,phase};current=run;container.append(canvas);container.dataset.live2d=id;
   gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
   const draw=now=>{
    if(current!==run)return;if(!container.isConnected){dispose();return}
    try{
     const r=container.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(r.width*ratio)),h=Math.max(1,Math.round(r.height*ratio));
     if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
     const disabled=document.body.classList.contains('character-motion-off'),gentle=matchMedia('(prefers-reduced-motion:reduce)').matches?.5:1;
     if(disabled)out.set(base);else rig.deform(base,out,aspect,profile,now/1000,phase,run.action,gentle);
     const fit=Math.min(w,h/aspect)*.97;gl.uniform2f(scale,2*fit/w,2*fit/h);gl.uniform1i(gl.getUniformLocation(program,'image'),0);
     gl.bindBuffer(gl.ARRAY_BUFFER,pos);gl.bufferData(gl.ARRAY_BUFFER,out,gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
     gl.bindBuffer(gl.ARRAY_BUFFER,tex);gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ind);gl.bindTexture(gl.TEXTURE_2D,texture);gl.drawElements(gl.TRIANGLES,mesh.indices.length,gl.UNSIGNED_SHORT,0);
     container.classList.add('live2d-ready');run.frame=requestAnimationFrame(draw);
    }catch(e){console.error('Character render failed',e);dispose()}
   };run.frame=requestAnimationFrame(draw);
  }catch(e){console.warn('Character rig unavailable',e);container.classList.remove('live2d-ready')}
 }
 window.BattleLive2D={mount,dispose,perform,recoil,anchor};
})();
