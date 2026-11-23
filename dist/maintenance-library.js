'use strict';
const maintenanceState={files:[],loaded:false,loading:false,error:'',query:'',selection:{kind:'folder',path:''},expanded:new Set(),busy:false,progress:'',upload:null,controller:null,previewURL:null};
const MAINTENANCE_API='/api/maintenance';
function maintenanceSize(bytes){return bytes<1024?bytes+' B':bytes<1024*1024?(bytes/1024).toFixed(1)+' KB':(bytes/1024/1024).toFixed(1)+' MB';}
async function maintenanceAPI(action='list',body,query={},signal){
  const url=new URL(MAINTENANCE_API,location.origin);url.searchParams.set('action',action);
  for(const [key,value] of Object.entries(query))url.searchParams.set(key,String(value));
  const binary=body instanceof Blob;
  const response=await fetch(url,{method:body===undefined?'GET':binary?'PUT':'POST',credentials:'same-origin',signal,headers:body===undefined?{}:{'Content-Type':binary?'application/octet-stream':'application/json','X-Maintenance-Request':'1'},body:body===undefined?undefined:binary?body:JSON.stringify(body)});
  if(!response.ok){
    const details=await response.json().catch(()=>({}));
    const error=new Error(details.error||(response.status===401?'Sign in again, then refresh the library.':details.conflicts?'Files with these paths already exist. Review and upload again.':'The document request failed. Please try again.'));
    error.status=response.status;throw error;
  }
  return action==='chunk'&&body===undefined?response.blob():response.json();
}
async function loadMaintenance(force=false){
  if(maintenanceState.loading||maintenanceState.loaded&&!force)return;
  maintenanceState.loading=true;maintenanceState.error='';
  try{const result=await maintenanceAPI();maintenanceState.files=result.files;maintenanceState.loaded=true;}
  catch(error){maintenanceState.error=error.message;maintenanceState.loaded=true;}
  finally{maintenanceState.loading=false;if(page==='maintenance'||page==='overview')render();}
}
function maintenanceVisibleFiles(){return maintenanceState.files.filter(f=>MaintenanceTree.matches(f,libraryFilter,maintenanceState.query));}
function maintenanceSelectedFiles(){
  const selected=maintenanceState.selection;
  // A folder assignment always applies to the whole folder, even with a search/filter active.
  return maintenanceState.files.filter(f=>selected.kind==='file'?f.path===selected.path:MaintenanceTree.inside(f.path,selected.path));
}
function maintenanceTargetNames(file){return (file.components||[]).map(c=>MaintenanceTree.targets[c]).filter(Boolean).join(', ')||'Unassigned';}
function maintenanceTreeMarkup(node,depth=0){
  const folders=[...node.folders.values()].sort((a,b)=>a.name.localeCompare(b.name));
  return `<ul class="maintenance-tree-list">${folders.map(folder=>`<li><details data-maint-folder="${esc(folder.path)}" ${depth<1||maintenanceState.expanded.has(folder.path)?'open':''}><summary><button class="maintenance-node ${maintenanceState.selection.kind==='folder'&&maintenanceState.selection.path===folder.path?'selected':''}" data-maint-select="folder" data-path="${esc(folder.path)}" title="${esc(folder.path)}"><span aria-hidden="true">▱</span> ${esc(folder.name)}</button></summary>${maintenanceTreeMarkup(folder,depth+1)}</details></li>`).join('')}${node.files.sort((a,b)=>a.name.localeCompare(b.name)).map(file=>`<li><button class="maintenance-node maintenance-file ${maintenanceState.selection.path===file.path&&maintenanceState.selection.kind==='file'?'selected':''}" data-maint-select="file" data-path="${esc(file.path)}" title="${esc(file.path)}"><span aria-hidden="true">▤</span> ${esc(file.name)}</button></li>`).join('')}</ul>`;
}
function maintenanceDocumentList(files){return `<div class="maintenance-document-list">${files.map(f=>`<button class="maintenance-document" data-maint-select="file" data-path="${esc(f.path)}"><span><strong>${esc(f.name)}</strong><small>${esc(f.path)}</small><small>${esc(maintenanceTargetNames(f))}</small></span><span class="muted">${maintenanceSize(f.size)} <span aria-hidden="true">↗</span></span></button>`).join('')}</div>`;}
function maintenanceSelectionPanel(){
  const selected=maintenanceState.selection,all=maintenanceSelectedFiles(),visible=all.filter(f=>MaintenanceTree.matches(f,libraryFilter,maintenanceState.query));
  const scoped=!selected.path&&(libraryFilter!=='all'||maintenanceState.query),file=selected.kind==='file'?all[0]:null,title=file?.name||selected.path.split('/').at(-1)||(scoped?(MaintenanceTree.targets[libraryFilter]||({'tank-oil':'Main tank & oil',unassigned:'Unassigned'}[libraryFilter])||'Matching')+' documents':'All documents');
  if(selected.kind==='file'&&!file)return '<div class="empty">Choose a folder or document from the file tree.</div>';
  const shared=Object.keys(MaintenanceTree.targets).filter(c=>all.length&&all.every(f=>f.components?.includes(c)));
  const mixed=all.length>1&&all.some(f=>JSON.stringify([...(f.components||[])].sort())!==JSON.stringify([...(all[0].components||[])].sort()));
  return `<div class="maintenance-selection-head"><div><p class="maintenance-kicker">${file?'DOCUMENT':'FOLDER'}</p><h2>${esc(title)}</h2><p class="sub">${esc(selected.path||(scoped?'Filtered shared library':'Entire shared library'))}</p></div>${file?`<div class="actions"><button class="btn" data-maint-download="${esc(file.id)}">Download</button>${maintenanceCanPreview(file)?`<button class="btn primary" data-maint-preview="${esc(file.id)}">Open document</button>`:''}</div>`:''}</div>
  ${file?`<p class="maintenance-file-meta">${maintenanceSize(file.size)} · Uploaded ${dateOnly(file.uploadedAt)}${!maintenanceCanPreview(file)?' · Download to open in its application.':''}</p>`:`<p class="maintenance-file-meta">${scoped?visible.length:all.length} ${(scoped?visible.length:all.length)===1?'document':'documents'}${!scoped&&visible.length!==all.length?` · ${visible.length} match the current filter`:''}</p>`}
  ${all.length&&!scoped?`<form id="maintenance-assignment" class="maintenance-assignment"><div><h3>Assign ${file?'document':'folder'} to components</h3><p>${file?'A document can belong to more than one component.':`Applies to ${all.length===1?'the document':`all ${all.length} documents`} in this folder and its subfolders, including files hidden by filters.`}${mixed?' Current assignments vary; saving replaces them with the selection below.':''}</p></div><div class="maintenance-targets">${Object.entries(MaintenanceTree.targets).map(([id,label])=>`<label><input type="checkbox" name="component" value="${id}" ${shared.includes(id)?'checked':''}>${esc(label)}</label>`).join('')}</div><div class="actions"><button class="btn primary" type="submit" ${maintenanceState.busy?'disabled':''}>Save assignments</button><span class="muted">Clear all checks to leave unassigned.</span></div></form>`:''}
  ${file?'':visible.length?maintenanceDocumentList(visible):`<div class="empty">${all.length?'No documents match this filter.':'Choose Upload folder to add your organized documents.'}</div>`}`;
}
function maintenanceLegacyRecords(){
  const records=data.maintenance.filter(r=>libraryFilter==='all'||r.component===libraryFilter||libraryFilter==='tank-oil'&&r.component==='tank');
  if(!records.length)return '';
  return `<details class="panel maintenance-legacy"><summary>${data.demo?'Example maintenance records':'Imported text records'} <span class="muted">(${records.length})</span></summary><p class="sub">${data.demo?'Illustrative placeholders. Uploaded documents appear in the shared folder library above.':'These spreadsheet records stay in this browser.'}</p><div class="library-list">${records.map(r=>`<div class="library-item"><div><h3>${esc(r.title)}</h3><p>${esc(COMPONENTS[r.component]?.name||'Transformer')} · ${dateOnly(r.date)}</p></div><button class="btn" data-record="${data.maintenance.indexOf(r)}">View ↗</button></div>`).join('')}</div></details>`;
}
function maintenanceLibraryPage(){
  const visible=maintenanceVisibleFiles();
  return heading('Maintenance library','Folders, standards, reports and history.',`<button class="btn" id="maintenance-refresh" ${maintenanceState.busy?'disabled':''}>Refresh</button><button class="btn primary" id="maintenance-upload" ${maintenanceState.busy?'disabled':''}>↥ Upload folder</button>`)+
  `<input id="maintenance-folder-input" type="file" webkitdirectory directory multiple hidden><p class="maintenance-sharing">Shared with everyone who can access this app. Folder names and organization are preserved.</p>
  <div id="maintenance-progress" class="maintenance-progress" role="status" aria-live="polite" ${maintenanceState.busy?'':'hidden'}><span>${esc(maintenanceState.progress)}</span><button class="btn" id="maintenance-cancel" ${maintenanceState.controller?'':'hidden'}>Cancel upload</button></div>
  ${maintenanceState.error?`<div class="import-alert error" role="alert">${esc(maintenanceState.error)} <button class="btn" id="maintenance-retry">Try again</button></div>`:''}
  <section class="panel maintenance-library"><div class="maintenance-toolbar"><label class="maintenance-search">Search documents<input id="maintenance-search" type="search" placeholder="Search filenames or folders…" value="${esc(maintenanceState.query)}"></label><label>Component<select id="library-component" aria-label="Maintenance component"><option value="all" ${libraryFilter==='all'?'selected':''}>All components</option><option value="unassigned" ${libraryFilter==='unassigned'?'selected':''}>Unassigned</option><option value="tank-oil" ${libraryFilter==='tank-oil'?'selected':''}>Main tank &amp; oil</option>${Object.entries(MaintenanceTree.targets).map(([id,label])=>`<option value="${id}" ${libraryFilter===id?'selected':''}>${esc(label)}</option>`).join('')}</select></label><span class="muted">${visible.length} / ${maintenanceState.files.length} documents</span></div>
  ${!maintenanceState.loaded?'<div class="empty" role="status">Loading shared library…</div>':!maintenanceState.files.length?`<div class="maintenance-empty"><span aria-hidden="true">▱</span><h2>Your organized folder, in one place</h2><p>Upload a folder containing maintenance standards, instructions, history and inspection reports. Its subfolders become the file tree, ready to assign to components.</p><button class="btn primary" id="maintenance-upload-empty" ${maintenanceState.busy?'disabled':''}>Choose folder</button><p class="muted">Up to 50 MB per file · 200 MB and 1,000 files per upload</p></div>`:`<div class="maintenance-workspace"><aside class="maintenance-tree" aria-label="Document folders"><button class="maintenance-node maintenance-root ${!maintenanceState.selection.path?'selected':''}" data-maint-select="folder" data-path="">▱ All documents</button>${maintenanceTreeMarkup(MaintenanceTree.build(visible))}${!visible.length?'<p class="empty">No matching documents.</p>':''}</aside><div class="maintenance-detail">${maintenanceSelectionPanel()}</div></div>`}</section>${maintenanceLegacyRecords()}`;
}
function maintenanceSelect(kind,path){
  maintenanceState.selection={kind,path};
  const pieces=path.split('/');for(let i=1;i<pieces.length;i++)maintenanceState.expanded.add(pieces.slice(0,i).join('/'));
  if(kind==='folder')maintenanceState.expanded.add(path);
  render();
}
function maintenanceSetProgress(message){
  maintenanceState.progress=message;
  const box=$('#maintenance-progress');if(box){box.hidden=!maintenanceState.busy;box.querySelector('span').textContent=message;const cancel=box.querySelector('button');cancel.hidden=!maintenanceState.controller;}
}
function maintenanceReview(fileList){
  if(maintenanceState.busy)return;
  let upload;try{upload=MaintenanceTree.prepare(fileList);}catch(error){notify(error.message);return;}
  const old=new Set(maintenanceState.files.map(f=>f.path)),replacements=upload.files.filter(f=>old.has(f.path));
  const roots=[...new Set(upload.files.map(f=>f.path.split('/')[0]))];
  showModal('Upload maintenance folder',`<p class="instructions">${upload.files.length} files · ${maintenanceSize(upload.bytes)}. These documents will be shared with everyone who has access to this app.</p><p class="instructions">Folder structure is preserved. Assign files or folders to components after uploading.</p>${replacements.length?`<div class="import-alert">${replacements.length} existing files have the same paths and will be replaced. Their component assignments will be retained. Other files stay in place.</div>`:''}<div class="maintenance-upload-review">${roots.map(root=>`<p><strong>▱ ${esc(root)}</strong></p>`).join('')}<ul>${upload.files.slice(0,8).map(f=>`<li>${esc(f.path)}</li>`).join('')}${upload.files.length>8?`<li>…and ${upload.files.length-8} more files</li>`:''}</ul></div><div class="actions"><button class="btn" id="maintenance-review-cancel">Cancel</button><button class="btn primary" id="maintenance-review-confirm">${replacements.length?'Upload and replace':'Upload folder'}</button></div>`);
  $('#maintenance-review-cancel').onclick=()=>$('#modal').close();
  $('#maintenance-review-confirm').onclick=()=>{$('#modal').close();maintenanceUpload(upload,replacements.length>0);};
}
async function maintenanceUpload(upload,replace){
  maintenanceState.busy=true;maintenanceState.error='';maintenanceState.controller=new AbortController();
  const signal=maintenanceState.controller.signal;let session,completed=false;
  maintenanceState.progress='Preparing upload…';render();
  try{
    session=await maintenanceAPI('begin',{replace,files:upload.files.map(({file,...metadata})=>metadata)},{},signal);
    let sent=0;
    for(let i=0;i<upload.files.length;i++){
      const entry=upload.files[i],parts=Math.max(1,Math.ceil(entry.size/session.chunkBytes));
      for(let part=0;part<parts;part++){
        const chunk=entry.file.slice(part*session.chunkBytes,(part+1)*session.chunkBytes);
        maintenanceSetProgress(`Uploading ${i+1} / ${upload.files.length} · ${entry.name} · ${maintenanceSize(sent)} / ${maintenanceSize(upload.bytes)}`);
        await maintenanceAPI('chunk',chunk,{upload:session.upload,file:i,part},signal);sent+=chunk.size;
      }
    }
    maintenanceState.controller=null;maintenanceSetProgress('Saving shared library…');
    const result=await maintenanceAPI('commit',{}, {upload:session.upload});
    completed=true;maintenanceState.files=result.files;maintenanceState.loaded=true;
    libraryFilter='all';maintenanceState.query='';maintenanceState.selection={kind:'folder',path:upload.files[0].path.split('/').slice(0,-1).slice(0,1).join('/')};
    notify(`${upload.files.length} documents uploaded. Choose components to assign them.`);
  }catch(error){maintenanceState.error=error.name==='AbortError'?'Upload cancelled. No partial folder was added.':error.message;}
  finally{
    if(session&&!completed)await maintenanceAPI('cancel',{}, {upload:session.upload}).catch(()=>{});
    maintenanceState.busy=false;maintenanceState.controller=null;maintenanceState.progress='';if(page==='maintenance')render();
  }
}
async function maintenanceSaveAssignments(event){
  event.preventDefault();if(maintenanceState.busy)return;
  const ids=maintenanceSelectedFiles().map(f=>f.id),components=[...event.currentTarget.querySelectorAll('input:checked')].map(input=>input.value);
  maintenanceState.busy=true;maintenanceState.error='';maintenanceState.progress='Saving component assignments…';render();
  try{const result=await maintenanceAPI('assign',{ids,components});maintenanceState.files=result.files;notify(`Assignments saved for ${ids.length} ${ids.length===1?'document':'documents'}.`);}
  catch(error){maintenanceState.error=error.message;}
  finally{maintenanceState.busy=false;maintenanceState.progress='';if(page==='maintenance')render();}
}
function maintenanceCanPreview(file){return /\.(pdf|png|jpe?g|gif|webp|txt|csv|log|md)$/i.test(file.name);}
async function maintenanceOpen(id,download=false){
  const file=maintenanceState.files.find(f=>f.id===id);if(!file)return;
  if(maintenanceState.previewURL){URL.revokeObjectURL(maintenanceState.previewURL);maintenanceState.previewURL=null;}
  showModal(file.name,'<p class="instructions" id="maintenance-open-status" role="status">Loading document…</p>');
  const dialog=$('#modal');
  try{
    const parts=[];for(let part=0;part<Math.max(1,Math.ceil(file.size/(2*1024*1024)));part++){
      parts.push(await maintenanceAPI('chunk',undefined,{id,part}));
      const status=$('#maintenance-open-status');if(status)status.textContent=`Loading document… ${maintenanceSize(parts.reduce((sum,p)=>sum+p.size,0))} / ${maintenanceSize(file.size)}`;
    }
    const ext=file.name.split('.').at(-1).toLowerCase();
    const mime={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',txt:'text/plain',md:'text/plain',csv:'text/plain',log:'text/plain'}[ext]||'application/octet-stream';
    const blob=new Blob(parts,{type:mime});
    if(blob.size!==file.size)throw Error('This document is incomplete. Try downloading again.');
    const url=URL.createObjectURL(blob);maintenanceState.previewURL=url;
    if(download){const a=document.createElement('a');a.href=url;a.download=file.name;a.click();showModal(file.name,'<p class="instructions">Download started.</p>');}
    else if(!dialog.open||!$('#maintenance-open-status')){URL.revokeObjectURL(url);maintenanceState.previewURL=null;}
    else if(mime==='text/plain'){showModal(file.name,`${blob.size>2*1024*1024?'<p class="sub">Showing the first 2 MB. Download the document to read it in full.</p>':''}<pre class="maintenance-text-preview">${esc(await blob.slice(0,2*1024*1024).text())}</pre>`);}
    else if(mime.startsWith('image/'))showModal(file.name,`<img class="maintenance-image-preview" src="${url}" alt="${esc(file.name)}">`);
    else showModal(file.name,`<p class="sub"><a href="${url}" download="${esc(file.name)}">Download PDF</a></p><iframe class="maintenance-pdf-preview" src="${url}" title="${esc(file.name)}"></iframe>`);
  }catch(error){if(dialog.open)showModal(file.name,`<p class="instructions" role="alert">${esc(error.message)}</p>`);}
}
function bindMaintenance(){
  if(page!=='maintenance'&&page!=='overview')return;
  if(!maintenanceState.loaded&&!maintenanceState.loading)loadMaintenance();
  if(page!=='maintenance')return;
  if($('#library-component'))$('#library-component').onchange=event=>{libraryFilter=event.target.value;maintenanceState.selection={kind:'folder',path:''};render();};
  const input=$('#maintenance-folder-input');
  for(const id of ['#maintenance-upload','#maintenance-upload-empty'])if($(id))$(id).onclick=()=>input.click();
  if(input)input.onchange=()=>{maintenanceReview([...input.files]);input.value='';};
  for(const id of ['#maintenance-refresh','#maintenance-retry'])if($(id))$(id).onclick=()=>loadMaintenance(true);
  if($('#maintenance-search'))$('#maintenance-search').oninput=event=>{
    const start=event.target.selectionStart;maintenanceState.query=event.target.value;render();const field=$('#maintenance-search');field.focus();try{field.setSelectionRange(start,start);}catch{}
  };
  document.querySelectorAll('[data-maint-select]').forEach(button=>button.onclick=event=>{event.preventDefault();event.stopPropagation();maintenanceSelect(button.dataset.maintSelect,button.dataset.path);});
  document.querySelectorAll('[data-maint-folder]').forEach(details=>details.ontoggle=()=>{if(details.open)maintenanceState.expanded.add(details.dataset.maintFolder);else maintenanceState.expanded.delete(details.dataset.maintFolder);});
  if($('#maintenance-assignment'))$('#maintenance-assignment').onsubmit=maintenanceSaveAssignments;
  if($('#maintenance-cancel'))$('#maintenance-cancel').onclick=()=>maintenanceState.controller?.abort();
  document.querySelectorAll('[data-maint-download]').forEach(button=>button.onclick=()=>maintenanceOpen(button.dataset.maintDownload,true));
  document.querySelectorAll('[data-maint-preview]').forEach(button=>button.onclick=()=>maintenanceOpen(button.dataset.maintPreview));
}
