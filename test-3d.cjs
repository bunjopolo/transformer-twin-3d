const fs=require('node:fs'),assert=require('node:assert/strict');
const data=fs.readFileSync('dist/models/transformer.glb');
assert.equal(data.toString('ascii',0,4),'glTF');assert.equal(data.readUInt32LE(4),2);assert.equal(data.readUInt32LE(8),data.length);
const gltf=JSON.parse(data.toString('utf8',20,20+data.readUInt32LE(12)).trim());
const required=['windings','cooling','bushings','tank','conservator','tapchanger'];
function meshes(n){return (n.mesh===undefined?0:1)+(n.children||[]).reduce((sum,i)=>sum+meshes(gltf.nodes[i]),0);}
for(const id of required){const nodes=gltf.nodes.filter(n=>n.extras?.component===id);assert.equal(nodes.length,1,id+' must have a stable component parent');assert.ok(meshes(nodes[0])>0,id+' has visible geometry');}
assert.ok(gltf.nodes.some(n=>/Front removable panel/.test(n.name)),'Cutaway front wall exists');
assert.ok(gltf.nodes.some(n=>/Removable tank lid/.test(n.name)),'Cutaway roof exists');
for(const file of ['three.module.js','three.core.js','GLTFLoader.js','OrbitControls.js','BufferGeometryUtils.js']){
 const source=fs.readFileSync('dist/vendor/three/'+file,'utf8');
 for(const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g))assert.ok(fs.existsSync(require('node:path').resolve('dist/vendor/three',match[1])),file+' dependency '+match[1]);
}
assert.ok(fs.existsSync('models/transformer.blend'));
console.log('PASS: GLB integrity, six component mappings, cutaway surfaces, editable source and local module dependencies.');
const removed=gltf.nodes.filter(n=>n.extras?.hideInCutaway===true);
for(const prefix of ['Lid bolt','Lifting lug','Removable tank lid','Front removable panel','Asset plate']){
 const parts=gltf.nodes.filter(n=>n.name.startsWith(prefix));assert.ok(parts.length>0,prefix+' exists');
 for(const part of parts)assert.ok(removed.includes(part),part.name+' disappears with the cutaway assembly');
}
assert.equal(gltf.nodes.filter(n=>n.name.startsWith('Tank stiffener')&&n.extras?.hideInCutaway).length,9,'Only front stiffeners are removed');
(async()=>{
 const {firstVisibleComponent,selectionGesture}=await import('./dist/model-selection.mjs');
 const statuses={tank:'normal',windings:'watch',cooling:'watch',bushings:'normal',conservator:'normal',tapchanger:'normal'};
 const mesh=(id,visible=true)=>({isMesh:true,visible,userData:{},parent:{visible:true,userData:{component:id}}});
 for(const id of Object.keys(statuses))assert.equal(firstVisibleComponent([{object:mesh(id)}],statuses),id,'Direct mesh selection: '+id);
 assert.equal(firstVisibleComponent([{object:mesh('tank',false)},{object:mesh('windings')}],statuses),'windings','Hidden panel does not intercept winding click');
 const hiddenParent=mesh('tank');hiddenParent.parent.visible=false;
 assert.equal(firstVisibleComponent([{object:hiddenParent},{object:mesh('cooling')}],statuses),'cooling','Hidden parent does not intercept click');
 assert.equal(firstVisibleComponent([{object:mesh('foundation')},{object:mesh('windings')}],statuses),null,'Opaque plinth occludes parts behind it');
 const e=(x,y,id=1,button=0)=>({clientX:x,clientY:y,pointerId:id,button});const g=selectionGesture();
 g.down(e(10,10));assert.equal(g.up(e(12,11)),true,'Small tap jitter selects');
 g.down(e(10,10));g.move(e(30,10));assert.equal(g.up(e(10,10)),false,'Drag returning to its origin does not select');
 g.down(e(10,10));assert.equal(g.up(e(40,10)),false,'Pointerup displacement alone does not select');
 g.down(e(10,10));g.down(e(20,20,2));assert.equal(g.up(e(20,20,2)),false);assert.equal(g.up(e(10,10)),false,'Pinch never selects');
 g.down(e(10,10));g.clear();assert.equal(g.up(e(10,10)),false,'Cancelled gesture never selects');
 g.down(e(10,10,1,2));assert.equal(g.up(e(10,10,1,2)),false,'Right click never selects');
 console.log('PASS: cutaway hardware membership, direct selection for six components, hidden geometry, occlusion, click/drag/pinch/cancel behavior.');
})().catch(error=>{console.error(error);process.exitCode=1;});
const terminalNodes=gltf.nodes.filter(n=>n.extras?.terminalId);
assert.deepEqual(terminalNodes.map(n=>n.extras.terminalId).sort(),['H1','H2','X1','X2']);
const bushingRoot=gltf.nodes.find(n=>n.extras?.component==='bushings');
for(const terminal of terminalNodes){
 assert.equal(terminal.extras.voltageSide,terminal.extras.terminalId.startsWith('H')?'HV':'LV');
 assert.ok(bushingRoot.children.includes(gltf.nodes.indexOf(terminal)),'All terminals retain the bushings component mapping');
 const children=terminal.children.map(i=>gltf.nodes[i]);
 assert.equal(children.filter(n=>n.name.startsWith('Porcelain stem')).length,1);
 assert.equal(children.filter(n=>n.name.startsWith('Terminal contact')).length,1);
 assert.ok(children.some(n=>n.name.startsWith(terminal.extras.terminalId+' terminal marking')),'Visible terminal ID');
}
assert.equal(terminalNodes.filter(n=>n.extras.voltageSide==='HV').length,2);
assert.equal(terminalNodes.filter(n=>n.extras.voltageSide==='LV').length,2);
console.log('PASS: single-phase H1/H2 HV and X1/X2 LV terminal pairs, visible IDs and preserved component ancestry.');
