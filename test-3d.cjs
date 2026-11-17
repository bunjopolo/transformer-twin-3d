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
