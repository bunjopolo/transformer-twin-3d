'use strict';
// Folder paths are display data, never filesystem paths or executable markup.
const MaintenanceTree = (() => {
  const targets = {windings:'Core & windings',cooling:'Cooling system',bushings:'HV / LV bushings',tank:'Main tank',oil:'Insulating oil',conservator:'Conservator',tapchanger:'Tap changer'};
  const limits = {files:1000,fileBytes:50*1024*1024,totalBytes:200*1024*1024};
  function path(value) {
    if(typeof value!=='string'||value.length>1000||/[\\\u0000-\u001f\u007f]/.test(value))throw Error('Invalid folder or file name.');
    const parts=value.split('/');
    if(parts.some(p=>!p||p==='.'||p==='..'))throw Error('Invalid folder or file path.');
    return parts.join('/');
  }
  function inside(filePath,folder){return !folder||filePath.startsWith(folder+'/');}
  function components(values){return [...new Set(values)].filter(v=>Object.hasOwn(targets,v));}
  function matches(file,filter,query=''){
    const assigned=file.components||[];
    return (filter==='all'||filter==='unassigned'&&!assigned.length||assigned.includes(filter)||filter==='tank-oil'&&assigned.some(c=>c==='tank'||c==='oil'))&&file.path.toLowerCase().includes(query.toLowerCase());
  }
  function build(files){
    const root={name:'All documents',path:'',folders:new Map(),files:[]};
    for(const file of files){
      const parts=path(file.path).split('/');let node=root;
      for(const name of parts.slice(0,-1)){
        if(!node.folders.has(name))node.folders.set(name,{name,path:node.path?node.path+'/'+name:name,folders:new Map(),files:[]});
        node=node.folders.get(name);
      }
      node.files.push(file);
    }
    return root;
  }
  function prepare(files){
    const selected=[],seen=new Set();let bytes=0;
    for(const file of files){
      const relative=path(file.webkitRelativePath||file.path||file.name);
      if(relative.split('/').some(p=>p==='.DS_Store'||p==='__MACOSX'||p.startsWith('._')))continue;
      if(seen.has(relative))throw Error('Duplicate path: '+relative);
      if(file.size>limits.fileBytes)throw Error(file.name+' exceeds the 50 MB file limit.');
      if(!Number.isSafeInteger(file.size)||file.size<0)throw Error('Invalid file size.');
      seen.add(relative);bytes+=file.size;selected.push({file,path:relative,size:file.size,name:relative.split('/').at(-1),type:file.type||'application/octet-stream',lastModified:file.lastModified||0});
    }
    if(!selected.length)throw Error('This folder contains no files to upload.');
    if(selected.length>limits.files||bytes>limits.totalBytes)throw Error('Choose up to 1,000 files and 200 MB per upload.');
    return {files:selected,bytes};
  }
  return {targets,limits,path,inside,components,matches,build,prepare};
})();
if(typeof module!=='undefined')module.exports=MaintenanceTree;
