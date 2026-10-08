const {app,BrowserWindow,protocol,session,Menu}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path');
const smoke=process.argv.includes('--offline-smoke-test');
if(smoke&&process.env.ARCHIVE_SMOKE_OUTPUT){const profile=path.resolve(process.env.ARCHIVE_SMOKE_OUTPUT,'profile');require('node:fs').mkdirSync(profile,{recursive:true});app.setPath('userData',profile)}
protocol.registerSchemesAsPrivileged([{scheme:'archive',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
app.setAppUserModelId('school.icn.edu.endlessarchive');
let window;
app.whenReady().then(async()=>{
 const site=path.join(app.getAppPath(),'site');
 protocol.handle('archive',async request=>{
  try{const url=new URL(request.url);if(url.hostname!=='game')return new Response('Not found',{status:404});
   const target=path.resolve(site,'.'+decodeURIComponent(url.pathname));
   if(target!==site&&!target.startsWith(site+path.sep))return new Response('Not found',{status:404});
   const file=target===site?path.join(site,'index.html'):target;
   const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.wasm':'application/wasm','.woff2':'font/woff2','.mp3':'audio/mpeg','.ogg':'audio/ogg'}[path.extname(file).toLowerCase()]||'application/octet-stream';
   return new Response(await fs.readFile(file),{headers:{'Content-Type':mime,'Cache-Control':'no-store'}});
  }catch{return new Response('Not found',{status:404})}
 });
 // The game cannot fall back to internet resources. This also proves offline tests.
 const requests=[];
 session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
  const remote=/^https?:\/\//i.test(details.url);if(remote)requests.push(details.url);callback({cancel:remote});
 });
 session.defaultSession.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
 Menu.setApplicationMenu(null);
 window=new BrowserWindow({width:1440,height:900,minWidth:720,minHeight:420,backgroundColor:'#07111c',show:!smoke,autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('archive://game/'))event.preventDefault()});
 window.webContents.on('before-input-event',(event,input)=>{if(input.type==='keyDown'&&input.key==='F11'){event.preventDefault();window.setFullScreen(!window.isFullScreen())}});
 await window.loadURL('archive://game/index.html');
 if(!smoke)return;
 console.log('PACKAGED_RESOURCES',JSON.stringify({isPackaged:app.isPackaged,site,resourcesPath:process.resourcesPath,exe:process.execPath}));
 const errors=[];window.webContents.on('console-message',(_event,details)=>{if(details.level==='error')errors.push(details.message)});
 await new Promise(resolve=>setTimeout(resolve,1800));
 const report=await window.webContents.executeJavaScript(`(async()=>{
  if(typeof Live2DCubismCore!=='object')throw Error('Cubism Core was not loaded locally');
  if(document.querySelectorAll('#loadoutCards [data-character-card]').length!==4)throw Error('Formation failed');
  const manifest=await fetch('offline-manifest.json').then(r=>r.json());
  let checked=0,imagesDecoded=0;for(const file of manifest.files){const r=await fetch(file.path);if(!r.ok)throw Error('Missing local asset: '+file.path);const bytes=await r.arrayBuffer();if(bytes.byteLength!==file.bytes)throw Error('Asset size mismatch: '+file.path);checked++;if(/\\.(webp|png|jpg|jpeg)$/i.test(file.path)){const image=new Image();image.src=file.path;await image.decode();if(!image.naturalWidth)throw Error('Image did not decode: '+file.path);imagesDecoded++}}
  for(const image of document.querySelectorAll('#loadoutCards img')){await image.decode();if(!image.naturalWidth||image.classList.contains('hidden'))throw Error('Formation image missing: '+image.src)}
  document.getElementById('avHelpBtn').click();if(!document.getElementById('avHelpDialog').open)throw Error('AV dialog failed');document.getElementById('closeAvHelp').click();
  localStorage.setItem('offline-smoke-persistence','OK');
  document.getElementById('startBtn').click();
  await new Promise(resolve=>setTimeout(resolve,1600));
  if(!document.body.classList.contains('battle-mode')||!document.getElementById('raidHud').textContent.includes('350'))throw Error('AV battle failed');
  const native=window.NativeCubism;return {assetsChecked:checked,imagesDecoded,formationImages:true,cubismLoaded:true,battleLoaded:true,avHelp:true,origin:location.origin};
 })()`);

 await new Promise(resolve=>setTimeout(resolve,300));
 const output=path.resolve(process.env.ARCHIVE_SMOKE_OUTPUT||path.join(app.getPath('temp'),'archive-smoke'));
 await fs.mkdir(output,{recursive:true});
 await fs.writeFile(path.join(output,'offline-smoke.png'),(await window.webContents.capturePage()).toPNG());
 await window.reload();await new Promise(resolve=>setTimeout(resolve,1000));
 report.persistence=await window.webContents.executeJavaScript(`localStorage.getItem('offline-smoke-persistence')==='OK'`);
 report.remoteRequests=requests;report.consoleErrors=errors;
 await fs.writeFile(path.join(output,'offline-smoke.json'),JSON.stringify(report,null,2));
 if(!report.persistence||requests.length)throw Error('Offline/persistence validation failed');
 console.log('OFFLINE_SMOKE_PASS',JSON.stringify(report));app.exit(0);
}).catch(error=>{console.error(error);app.exit(1)});
app.on('window-all-closed',()=>app.quit());
