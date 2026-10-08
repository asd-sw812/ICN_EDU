const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),site=path.join(__dirname,'site');
const coreURL='https://cubism.live2d.com/sdk-web/core/06/live2dcubismcore.min.js';
async function download(url){const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error(`Download failed: ${response.status} ${url}`);return Buffer.from(await response.arrayBuffer())}
async function walk(dir){const list=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())list.push(...await walk(p));else list.push(p)}return list}
(async()=>{
 await fs.rm(site,{recursive:true,force:true});await fs.mkdir(site,{recursive:true});
 await fs.cp(path.join(root,'assets'),path.join(site,'assets'),{recursive:true});
 let html=await fs.readFile(path.join(root,'game'),'utf8');
 if(!html.includes(coreURL))throw Error('Canonical Cubism reference changed; review offline preparation');
 html=html.replace(coreURL,'assets/vendor/live2d/live2dcubismcore.min.js');
 if(/(?:src|href)\s*=\s*["']https?:\/\//i.test(html))throw Error('External HTML dependency remains');
 await fs.writeFile(path.join(site,'index.html'),html);
 const vendor=path.join(site,'assets/vendor/live2d');await fs.mkdir(vendor,{recursive:true});
 const core=await download(coreURL);if(core.length<10000||!core.toString().includes('Live2DCubismCore'))throw Error('Invalid Cubism download');
 await fs.writeFile(path.join(vendor,'live2dcubismcore.min.js'),core);
 const license=await download('https://raw.githubusercontent.com/Live2D/CubismWebSamples/develop/LICENSE.md');
 await fs.writeFile(path.join(vendor,'LICENSE.md'),license);
 await fs.writeFile(path.join(vendor,'NOTICE.txt'),'This application contains Live2D Cubism SDK developed by Live2D Inc. of which the copyrights are held by Live2D Inc.\nCubism Core is subject to the Live2D Proprietary Software License Agreement.\nhttps://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html\n');
 const files=await walk(site),entries=[];for(const file of files){const bytes=await fs.readFile(file);entries.push({path:path.relative(site,file).split(path.sep).join('/'),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')})}
 const report={sourceCommit:process.env.GITHUB_SHA||null,builtAt:new Date().toISOString(),coreSource:coreURL,coreSHA256:crypto.createHash('sha256').update(core).digest('hex'),files:entries};
 await fs.writeFile(path.join(site,'offline-manifest.json'),JSON.stringify(report,null,2));
 await fs.writeFile(path.join(__dirname,'build-manifest.json'),JSON.stringify(report,null,2));
 console.log(`Prepared ${files.length} files, ${entries.reduce((n,e)=>n+e.bytes,0)} bytes; all runtime content is local.`);
})().catch(e=>{console.error(e);process.exitCode=1});
