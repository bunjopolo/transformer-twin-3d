import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createMaintenanceHandler,CHUNK_BYTES } from './netlify/lib/maintenance-service.mjs';
const require=createRequire(import.meta.url),tree=require('./dist/maintenance-tree.js');
class MemoryStore {
  records=new Map();serial=0;
  async getWithMetadata(key){return structuredClone(this.records.get(key)||null);}
  async get(key){return structuredClone(this.records.get(key)?.data??null);}
  async getMetadata(key){const record=this.records.get(key);return record?{etag:record.etag,metadata:record.metadata}:null;}
  async set(key,data,options={}){
    const current=this.records.get(key);
    if(options.onlyIfNew&&current||options.onlyIfMatch&&options.onlyIfMatch!==current?.etag)return {modified:false};
    const etag=String(++this.serial);this.records.set(key,{data:structuredClone(data),etag,metadata:options.metadata||{}});return {modified:true,etag};
  }
  async setJSON(...args){return this.set(...args);}
  async delete(key){this.records.delete(key);}
}
const store=new MemoryStore();
const handler=createMaintenanceHandler({getStore:()=>store,getPassword:()=> 'test-password'});
const authorization='Basic '+Buffer.from('viewer:test-password').toString('base64');
async function call(action='list',body,query={},extra={}){
  const url=new URL('https://private.example/api/maintenance');url.searchParams.set('action',action);for(const [k,v]of Object.entries(query))url.searchParams.set(k,v);
  const binary=body instanceof Uint8Array;
  return handler(new Request(url,{method:body===undefined?'GET':binary?'PUT':'POST',headers:{authorization,'x-maintenance-request':'1','origin':'https://private.example',...extra},body:body===undefined?undefined:binary?body:JSON.stringify(body)}));
}
const metadata=(path,size=3)=>({path,size,type:'text/plain',lastModified:0});
async function begin(files,replace=false){const r=await call('begin',{files,replace});assert.equal(r.status,200);return r.json();}
async function upload(files,replace=false){
  const session=await begin(files,replace);
  for(let i=0;i<files.length;i++)for(let part=0;part<Math.max(1,Math.ceil(files[i].size/CHUNK_BYTES));part++){
    const bytes=new Uint8Array(Math.min(CHUNK_BYTES,Math.max(0,files[i].size-part*CHUNK_BYTES))).fill(65+i);
    assert.equal((await call('chunk',bytes,{upload:session.upload,file:i,part})).status,200);
  }
  const r=await call('commit',{}, {upload:session.upload});assert.equal(r.status,200);return {session,index:await r.json()};
}
assert.equal((await call('list',undefined,{}, {authorization:''})).status,401);
assert.equal((await call('begin',{files:[metadata('a.txt')]},{},{origin:'https://other.example'})).status,403);
assert.equal((await call('begin',{files:[metadata('a.txt')]},{},{'x-maintenance-request':''})).status,403);
for(const path of ['../outside','/absolute','folder//file','folder/../file','folder\\file','bad\nfile']){
  assert.throws(()=>tree.path(path));assert.equal((await call('begin',{files:[metadata(path)]})).status,400);
}
assert.equal((await call('begin',{files:[metadata('big.pdf',51*1024*1024)]})).status,413);
assert.equal((await call('begin',{files:[metadata('same'),metadata('same')]})).status,400);
const unfinished=await begin([metadata('Folder/incomplete.txt')]);
assert.equal((await call('commit',{}, {upload:unfinished.upload})).status,409);
assert.equal((await (await call()).json()).files.length,0,'partial upload must not publish');
assert.equal((await call('cancel',{}, {upload:unfinished.upload})).status,200);
const initial=await upload([metadata('Plant/Windings/Standards/guide.txt',CHUNK_BYTES+5),metadata('Plant/Oil/History/sample.csv'),metadata('Plant/Tank/Inspection/empty.txt',0)]);
assert.equal(initial.index.files.length,3);
const winding=initial.index.files.find(f=>f.path.includes('Windings'));
const part=await call('chunk',undefined,{id:winding.id,part:1});assert.equal((await part.arrayBuffer()).byteLength,5);
assert.equal((await call('chunk',undefined,{id:winding.id,part:5})).status,400);
assert.equal((await call('chunk',undefined,{id:'nonexistent',part:0})).status,404);
assert.equal((await call('assign',{ids:[winding.id],components:['windings','oil']})).status,200);
assert.equal((await call('assign',{ids:[winding.id],components:['invented']})).status,400);
assert.equal((await call('assign',{ids:['missing'],components:['windings']})).status,409);
const duplicate=await call('begin',{files:[metadata(winding.path)]});assert.equal(duplicate.status,409);
const replaced=await upload([metadata(winding.path)],true);
assert.deepEqual(replaced.index.files.find(f=>f.path===winding.path).components,['windings','oil'],'replacing a file preserves assignment');
assert.equal(replaced.index.files.length,3,'unrelated files survive replacement');
assert.equal((await call('chunk',undefined,{id:winding.id,part:0})).status,404,'old versions are not downloadable');
assert.equal((await call('commit',{}, {upload:replaced.session.upload})).status,200,'commit is retryable');
assert.equal((await call('cancel',{}, {upload:replaced.session.upload})).status,200);
const current=(await (await call()).json()).files.find(f=>f.path===winding.path);
assert.equal((await call('chunk',undefined,{id:current.id,part:0})).status,200,'late cancellation never removes committed content');
const all=(await (await call()).json()).files;
await Promise.all(all.map((f,i)=>call('assign',{ids:[f.id],components:[i%2?'tank':'oil']})));
assert.ok((await (await call()).json()).files.every(f=>f.components.length===1),'concurrent assignments retain every update');
const structure=tree.build(all);assert.ok(structure.folders.get('Plant').folders.has('Windings'));
assert.equal(tree.inside('Plant/WindingsExtra/a','Plant/Windings'),false);
assert.equal(tree.matches({path:'a',components:['oil']},'tank-oil'),true);
assert.equal(tree.matches({path:'a',components:[]},'unassigned'),true);
assert.equal(tree.matches({path:'Plant/Oil/report.txt',components:['oil']},'oil','REPORT'),true);
const prepared=tree.prepare([{webkitRelativePath:'Root/Sub/one.txt',name:'one.txt',size:3},{webkitRelativePath:'Root/.DS_Store',name:'.DS_Store',size:5}]);
assert.equal(prepared.files.length,1);assert.equal(prepared.files[0].path,'Root/Sub/one.txt');
// Render the real library with hostile file/folder names, with no browser globals needed.
const ctx=vm.createContext({console,Date,setTimeout,clearTimeout,structuredClone,localStorage:{getItem:()=>null}});
for(const name of ['tag-catalog','smartsignal','maintenance-tree','maintenance-library'])vm.runInContext(await readFile(`dist/${name}.js`,'utf8'),ctx);
const app=await readFile('dist/app.js','utf8');vm.runInContext(app.slice(0,app.lastIndexOf("document.querySelectorAll('.nav')")),ctx);
vm.runInContext(`maintenanceState.loaded=true;maintenanceState.files=[{id:'x',name:'<img onerror=alert(1)>.txt',path:'Folder/<img onerror=alert(1)>.txt',size:3,components:['oil']}];maintenanceState.selection={kind:'folder',path:'Folder'};`,ctx);
const html=vm.runInContext('maintenanceLibraryPage()',ctx);
assert.ok(html.includes('&lt;img onerror=alert(1)&gt;.txt'));assert.ok(!html.includes('<img onerror='));
assert.ok(html.includes('Insulating oil'));assert.ok(html.includes('webkitdirectory'));assert.ok(html.includes('Shared with everyone'));
vm.runInContext(`go=p=>{page=p};component='tank';openDetail()`,ctx);assert.equal(vm.runInContext('libraryFilter',ctx),'tank-oil');
console.log('PASS: folder paths, atomic upload, multi-part/empty files, auth/CSRF, replacement, assignment preservation/concurrency, component filters, escaping, and component document navigation.');
