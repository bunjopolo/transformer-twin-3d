import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';

export const CHUNK_BYTES = 2 * 1024 * 1024;
const FILE_BYTES = 50 * 1024 * 1024, UPLOAD_BYTES = 200 * 1024 * 1024;
const TARGETS = new Set(['windings','cooling','bushings','tank','oil','conservator','tapchanger']);
const UUID = /^[0-9a-f-]{36}$/;
const fail = (status,message) => { throw Object.assign(new Error(message),{status}); };
const headers = {'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
const json = (value,status=200) => Response.json(value,{status,headers});
const digest = value => createHash('sha256').update(value).digest();
function authorize(request,password,username) {
  if(!password)fail(503,'Document storage is not configured.');
  const match=/^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(request.headers.get('authorization')||'');
  const decoded=match&&match[1].length<4096?Buffer.from(match[1],'base64').toString('utf8'):'';
  if(!timingSafeEqual(digest(decoded),digest(`${username}:${password}`)))fail(401,'Sign in to access documents.');
  if(request.method!=='GET'){
    const origin=request.headers.get('origin');
    if(request.headers.get('x-maintenance-request')!=='1'||origin&&origin!==new URL(request.url).origin)fail(403,'This request must come from the app.');
  }
}
function cleanPath(value){
  if(typeof value!=='string'||!value||value.length>1000||/[\\\u0000-\u001f\u007f]/.test(value)||value.split('/').some(p=>!p||p==='.'||p==='..'))fail(400,'Invalid file path.');
  return value;
}
async function bodyJSON(request){
  const text=await request.text();if(text.length>2*1024*1024)fail(413,'Too many document details.');
  try{return JSON.parse(text);}catch{fail(400,'Invalid request.');}
}
async function indexSnapshot(store){return await store.getWithMetadata('index',{type:'json'})||{data:{files:[]},etag:null};}
async function updateIndex(store,change){
  for(let attempt=0;attempt<6;attempt++){
    const snap=await indexSnapshot(store),next=change(structuredClone(snap.data));
    const result=await store.setJSON('index',next,snap.etag?{onlyIfMatch:snap.etag}:{onlyIfNew:true});
    if(result.modified)return next;
  }
  fail(409,'The library changed. Refresh and try again.');
}
function partCount(file){return Math.max(1,Math.ceil(file.size/CHUNK_BYTES));}
function chunkKey(file,part){return `files/${file.id}/${part}`;}
async function inBatches(items,work){
  for(let i=0;i<items.length;i+=16)await Promise.all(items.slice(i,i+16).map(work));
}
async function removeContents(store,files){
  for(const file of files)for(let part=0;part<partCount(file);part++)await store.delete(chunkKey(file,part));
}
export function createMaintenanceHandler({getStore,getPassword,getUsername=()=> 'viewer'}){
  return async request=>{
    try{
      authorize(request,getPassword(),getUsername());
      const store=getStore(),url=new URL(request.url),action=url.searchParams.get('action')||'list';
      if(request.method==='GET'&&action==='list')return json((await indexSnapshot(store)).data);
      if(request.method==='GET'&&action==='chunk'){
        const id=url.searchParams.get('id'),part=Number(url.searchParams.get('part'));
        const file=(await indexSnapshot(store)).data.files.find(f=>f.id===id);
        if(!file)fail(404,'Document not found. Refresh the library.');
        if(!Number.isInteger(part)||part<0||part>=partCount(file))fail(400,'Invalid file part.');
        const bytes=await store.get(chunkKey(file,part),{type:'arrayBuffer'});
        if(bytes===null)fail(404,'Document content is unavailable.');
        return new Response(bytes,{headers:{...headers,'Content-Type':'application/octet-stream','Content-Disposition':'attachment'}});
      }
      if(request.method==='POST'&&action==='begin'){
        const body=await bodyJSON(request);
        if(!Array.isArray(body.files)||!body.files.length||body.files.length>1000)fail(400,'Choose between 1 and 1,000 files.');
        const snap=(await indexSnapshot(store)).data,old=new Map(snap.files.map(f=>[f.path,f]));
        const seen=new Set();let total=0;
        const files=body.files.map(f=>{
          const path=cleanPath(f.path);if(seen.has(path))fail(400,'Duplicate file path.');seen.add(path);
          if(!Number.isSafeInteger(f.size)||f.size<0||f.size>FILE_BYTES)fail(413,'Files must be 50 MB or smaller.');
          total+=f.size;
          return {id:randomUUID(),path,name:path.split('/').at(-1),size:f.size,type:typeof f.type==='string'?f.type.slice(0,100):'',lastModified:Number.isFinite(f.lastModified)?f.lastModified:0,components:[],uploadedAt:new Date().toISOString(),previousId:old.get(path)?.id||null};
        });
        if(total>UPLOAD_BYTES)fail(413,'Choose up to 200 MB per upload.');
        if(snap.files.filter(f=>!seen.has(f.path)).length+files.length>2000)fail(413,'The library supports up to 2,000 files.');
        const conflicts=files.filter(f=>f.previousId).map(f=>f.path);
        if(conflicts.length&&!body.replace) return json({conflicts},409);
        const upload=randomUUID();await store.setJSON('uploads/'+upload,{files,createdAt:Date.now()},{onlyIfNew:true});
        return json({upload,chunkBytes:CHUNK_BYTES});
      }
      if(['chunk','commit','cancel'].includes(action)){
        const upload=url.searchParams.get('upload');if(!UUID.test(upload||''))fail(400,'Invalid upload.');
        const session=await store.get('uploads/'+upload,{type:'json'});if(!session)fail(404,'Upload not found. Start the upload again.');
        if(request.method==='POST'&&action==='cancel'){
          const committed=new Set((await indexSnapshot(store)).data.files.map(f=>f.id));
          await removeContents(store,session.files.filter(f=>!committed.has(f.id)));
          await store.delete('uploads/'+upload);return json({cancelled:true});
        }
        if(Date.now()-session.createdAt>24*3600000)fail(410,'This upload expired. Start it again.');
        if(request.method==='PUT'&&action==='chunk'){
          const number=Number(url.searchParams.get('file')),part=Number(url.searchParams.get('part'));
          const file=Number.isInteger(number)?session.files[number]:null;
          if(!file||!Number.isInteger(part)||part<0||part>=partCount(file))fail(400,'Invalid file part.');
          const bytes=await request.arrayBuffer(),expected=Math.min(CHUNK_BYTES,Math.max(0,file.size-part*CHUNK_BYTES));
          if(bytes.byteLength!==expected)fail(400,'Incomplete file part. Retry the upload.');
          await store.set(chunkKey(file,part),bytes,{metadata:{bytes:bytes.byteLength},onlyIfNew:true});
          return json({saved:true});
        }
        if(request.method==='POST'&&action==='commit'){
          const parts=session.files.flatMap(file=>Array.from({length:partCount(file)},(_,part)=>({file,part})));
          await inBatches(parts,async({file,part})=>{
            const info=await store.getMetadata(chunkKey(file,part));
            if(info?.metadata.bytes!==Math.min(CHUNK_BYTES,Math.max(0,file.size-part*CHUNK_BYTES)))fail(409,'Upload is incomplete. Retry the upload.');
          });
          const next=await updateIndex(store,index=>{
            const existing=new Map(index.files.map(f=>[f.path,f]));
            for(const file of session.files){
              const current=existing.get(file.path);
              if(current?.id===file.id)continue; // Retry after a lost commit response.
              if((current?.id||null)!==file.previousId)fail(409,'A document changed during upload. Refresh and upload again.');
              const {previousId,...saved}=file;existing.set(file.path,{...saved,components:current?.components||[]});
            }
            return {files:[...existing.values()].sort((a,b)=>a.path.localeCompare(b.path))};
          });
          // Keep the session for idempotent retries; its staged files are now published.
          return json(next);
        }
      }
      if(request.method==='POST'&&action==='assign'){
        const {ids,components}=await bodyJSON(request);
        if(!Array.isArray(ids)||!ids.length||ids.length>2000||!Array.isArray(components)||components.some(c=>!TARGETS.has(c)))fail(400,'Select documents and valid components.');
        const wanted=new Set(ids),assigned=[...new Set(components)];
        return json(await updateIndex(store,index=>{
          if([...wanted].some(id=>!index.files.some(f=>f.id===id)))fail(409,'A selected document changed. Refresh and try again.');
          return {files:index.files.map(f=>wanted.has(f.id)?{...f,components:assigned}:f)};
        }));
      }
      fail(405,'Unsupported document operation.');
    }catch(error){
      if(!error.status)console.error('Maintenance storage operation failed:',error.name);
      return json({error:error.status?error.message:'Document storage is unavailable. Please try again.'},error.status||503);
    }
  };
}
