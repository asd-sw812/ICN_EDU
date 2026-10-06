/* Render the meshes and keyforms exported by Cubism Editor. */
(()=>{
 let run=null,ticket=0,pending=null;
 async function read(url,type){const r=await fetch(url);if(!r.ok)throw Error(`Cubism asset ${r.status}: ${url}`);return r[type]()}
 function dispose(){ticket++;if(!run)return;cancelAnimationFrame(run.frame);run.canvas.remove();run.container.classList.remove('live2d-ready');run.model.release();run.moc._release();run.gl.getExtension('WEBGL_lose_context')?.loseContext();run=null}
 function perform(id,options){pending={id,...options,start:performance.now()/1000};if(run?.id===id)run.action=pending}
 function shader(gl,type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
 async function mount(container,id,config){
  if(run?.container===container&&run.id===id)return;
  dispose();const own=++ticket;let model,moc,gl;
  try{
   const url=new URL(config.Model3,document.baseURI),spec=await read(url,'json');
   const C=window.Live2DCubismCore;if(!C)throw Error('Cubism Core unavailable');
   moc=C.Moc.fromArrayBuffer(await read(new URL(spec.FileReferences.Moc,url),'arrayBuffer'));
   if(!moc)throw Error('Invalid Cubism model');model=C.Model.fromMoc(moc);
   const images=await Promise.all(spec.FileReferences.Textures.map(src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=new URL(src,url)})));
   if(own!==ticket||!container.isConnected){model.release();moc._release();return}
   const canvas=document.createElement('canvas');canvas.className='cubism-character';canvas.setAttribute('aria-label','Cubism 전투 캐릭터');
   gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true});if(!gl)throw Error('WebGL unavailable');
   const program=gl.createProgram();gl.attachShader(program,shader(gl,gl.VERTEX_SHADER,'attribute vec2 p;attribute vec2 uv;uniform vec2 scale;varying vec2 tex;void main(){gl_Position=vec4(p*scale,0.,1.);tex=uv;}'));
   gl.attachShader(program,shader(gl,gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D image;uniform float opacity;varying vec2 tex;void main(){gl_FragColor=texture2D(image,vec2(tex.x,1.-tex.y))*opacity;}'));
   gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
   const d=model.drawables;if(Array.from(d.maskCounts).some(Boolean))throw Error('This rear renderer requires models without clipping masks');
   const loc={p:gl.getAttribLocation(program,'p'),uv:gl.getAttribLocation(program,'uv'),scale:gl.getUniformLocation(program,'scale'),opacity:gl.getUniformLocation(program,'opacity')};
   const textures=images.map(im=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t});
   const buffers=d.ids.map((_,i)=>{const p=gl.createBuffer(),uv=gl.createBuffer(),index=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,uv);gl.bufferData(gl.ARRAY_BUFFER,d.vertexUvs[i],gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,d.indices[i],gl.STATIC_DRAW);return {p,uv,index}});
   const info=model.canvasinfo,aspect=info.CanvasHeight/info.CanvasWidth,unit=info.PixelsPerUnit/info.CanvasWidth;
   const state={id,container,canvas,model,moc,gl,frame:0,action:pending?.id===id?pending:null};run=state;container.append(canvas);container.dataset.live2d=id;
   const param=(id,v)=>{const p=model.parameters,i=p.ids.indexOf(id);if(i>=0)p.values[i]=Math.max(p.minimumValues[i],Math.min(p.maximumValues[i],v))};
   const draw=now=>{
    if(run!==state)return;if(!container.isConnected){dispose();return}
    try{
     const r=container.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(r.width*ratio)),h=Math.max(1,Math.round(r.height*ratio));
     if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
     const t=now/1000,gain=document.body.classList.contains('character-motion-off')?0:matchMedia('(prefers-reduced-motion:reduce)').matches?.5:1;
     model.parameters.values.set(model.parameters.defaultValues);
     param('ParamAngleX',Math.sin(t*1.35)*7*gain);param('ParamAngleY',Math.sin(t*1.8)*5*gain);param('ParamAngleZ',Math.sin(t*1.6)*8*gain);param('ParamBreath',(.5+.5*Math.sin(t*1.8))*gain);
     const a=state.action;if(a&&t<a.start+a.total/1000){const u=Math.max(0,Math.min(1,(t-a.start)/(a.total/1000))),strike=Math.sin(u*Math.PI)*(a.strength||1)*gain;param('ParamAngleX',strike*25);param('ParamAngleY',strike*-12);param('ParamAngleZ',strike*20)}
     model.update();
     const fit=Math.min(w,h/aspect)*.97;gl.uniform2f(loc.scale,2*fit*unit/w,2*fit*unit/h);gl.uniform1i(gl.getUniformLocation(program,'image'),0);gl.enable(gl.BLEND);gl.disable(gl.DEPTH_TEST);
     const renderOrders=d.renderOrders||model.renderOrders;
     const order=d.ids.map((_,i)=>i).sort((a,b)=>renderOrders[a]-renderOrders[b]);
     for(const i of order){if(!C.Utils.hasIsVisibleBit(d.dynamicFlags[i])||d.opacities[i]<=0)continue;const b=buffers[i],flags=d.constantFlags[i];if(C.Utils.hasIsDoubleSidedBit(flags))gl.disable(gl.CULL_FACE);else{gl.enable(gl.CULL_FACE);gl.frontFace(gl.CCW)}
      if(C.Utils.hasBlendAdditiveBit(flags))gl.blendFunc(gl.ONE,gl.ONE);else if(C.Utils.hasBlendMultiplicativeBit(flags))gl.blendFunc(gl.DST_COLOR,gl.ONE_MINUS_SRC_ALPHA);else gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1f(loc.opacity,d.opacities[i]);gl.bindBuffer(gl.ARRAY_BUFFER,b.p);gl.bufferData(gl.ARRAY_BUFFER,d.vertexPositions[i],gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(loc.p);gl.vertexAttribPointer(loc.p,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,b.uv);gl.enableVertexAttribArray(loc.uv);gl.vertexAttribPointer(loc.uv,2,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b.index);gl.bindTexture(gl.TEXTURE_2D,textures[d.textureIndices[i]]);gl.drawElements(gl.TRIANGLES,d.indices[i].length,gl.UNSIGNED_SHORT,0);
     }
     d.resetDynamicFlags();container.classList.add('live2d-ready');state.frame=requestAnimationFrame(draw);
    }catch(e){console.error('Cubism model render failed',e);dispose()}
   };state.frame=requestAnimationFrame(draw);
  }catch(e){model?.release();moc?._release();gl?.getExtension('WEBGL_lose_context')?.loseContext();container.classList.remove('live2d-ready');throw e}
 }
 window.NativeRearCubism={mount,dispose,perform,active:(id,container)=>run?.id===id&&run.container===container};
})();
