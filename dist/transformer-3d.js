import * as THREE from 'three';
import { OrbitControls } from './vendor/three/OrbitControls.js';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';

// Keep one renderer and camera across the dashboard's full DOM renders.
let renderer, scene, camera, controls, model, observer, host, state, failed=false;
let previousComponent=null, cutaway=true, start=null, moved=false, activePointers=new Set(), frame=0;
const viewport=document.createElement('div');
viewport.className='model-viewport';
const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
const home=new THREE.Vector3(5.5,5.5,10), target=new THREE.Vector3(-.6,2,0);
const componentOf=obj=>{for(let n=obj;n;n=n.parent){if(n.userData.component)return n.userData.component;}return null;};
const isCutawayPanel=obj=> /Front_removable|Removable_tank|Asset_plate/.test(obj.name)||(/Tank_stiffener/.test(obj.name)&&obj.position.z>0);
function draw(){frame=0;if(renderer&&host?.isConnected)renderer.render(scene,camera);}
function invalidate(){if(!frame)frame=requestAnimationFrame(draw);}
function resize(){if(!host)return;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();invalidate();}
function message(text){const el=document.querySelector('#model-message');if(el)el.textContent=text;}
function applyState(){
  if(!model||!state)return;
  model.traverse(obj=>{
    if(!obj.isMesh)return;
    const id=componentOf(obj), selected=id===state.component;
    obj.visible=!(cutaway&&isCutawayPanel(obj));
    const m=obj.material;
    m.color.copy(obj.userData.baseColor);
    m.emissive.setHex(0x000000);
    if(state.overlay&&state.statuses[id]==='watch')m.color.lerp(new THREE.Color('#be8b39'),.5);
    if(selected){m.emissive.set('#326d51');m.emissiveIntensity=.18;}
  });
  document.querySelector('#model-cutaway')?.setAttribute('aria-pressed',String(cutaway));
  const c=document.querySelector('#model-cutaway');if(c)c.textContent=cutaway?'Cutaway on':'Cutaway off';
  invalidate();
}
function pick(event){
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer,camera);
  const hit=raycaster.intersectObject(model,true).find(h=>h.object.visible);
  // The opaque foundation also occludes selection.
  const id=hit&&componentOf(hit.object);
  return id&&state.statuses[id]!==undefined?id:null;
}
function initialize(){
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  viewport.append(renderer.domElement);
  const canvas=renderer.domElement;
  canvas.tabIndex=0;canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','Interactive transformer. Drag to rotate, scroll to zoom, arrow keys to rotate. Choose components using the buttons below.');
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(37,1,.1,100);
  camera.position.copy(home);
  controls=new OrbitControls(camera,canvas);controls.target.copy(target);
  controls.minDistance=5;controls.maxDistance=24;controls.maxPolarAngle=Math.PI*.49;
  controls.enablePan=false;controls.update();controls.addEventListener('change',invalidate);
  scene.add(new THREE.HemisphereLight(0xffffff,0x778c7f,2.8));
  const sun=new THREE.DirectionalLight(0xfff6e8,3.5);sun.position.set(4,9,7);scene.add(sun);
  const rim=new THREE.DirectionalLight(0xd5e5ff,2);rim.position.set(-6,4,-5);scene.add(rim);
  canvas.addEventListener('pointerdown',e=>{activePointers.add(e.pointerId);if(activePointers.size>1)moved=true;else{start=[e.clientX,e.clientY];moved=false;}});
  canvas.addEventListener('pointermove',e=>{if(start&&Math.hypot(e.clientX-start[0],e.clientY-start[1])>5)moved=true;if(!start&&model)canvas.style.cursor=pick(e)?'pointer':'grab';});
  canvas.addEventListener('pointerup',e=>{const click=start&&!moved&&activePointers.size===1&&e.button===0;activePointers.delete(e.pointerId);if(!activePointers.size)start=null;if(click&&model){const id=pick(e);if(id){if(id==='windings')cutaway=true;state.onSelect(id);}}});
  canvas.addEventListener('pointercancel',e=>{activePointers.delete(e.pointerId);start=null;moved=true;});
  canvas.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key))return;
    e.preventDefault();
    if(e.key==='Home'){reset();return;}
    const offset=camera.position.clone().sub(controls.target),s=new THREE.Spherical().setFromVector3(offset);
    if(e.key==='ArrowLeft')s.theta-=.13;if(e.key==='ArrowRight')s.theta+=.13;
    if(e.key==='ArrowUp')s.phi=Math.max(.1,s.phi-.13);if(e.key==='ArrowDown')s.phi=Math.min(Math.PI*.49,s.phi+.13);
    if(e.key==='+'||e.key==='=')s.radius=Math.max(5,s.radius*.9);if(e.key==='-')s.radius=Math.min(24,s.radius*1.1);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));controls.update();invalidate();
  });
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();failed=true;message('3D graphics paused. Reload to retry, or use the 2D view.');});
  observer=new ResizeObserver(resize);
  new GLTFLoader().load('./models/transformer.glb',gltf=>{
    model=gltf.scene;
    model.traverse(obj=>{if(obj.isMesh){obj.material=obj.material.clone();obj.userData.baseColor=obj.material.color.clone();}});
    scene.add(model);message('Illustrative model · Select a part to inspect');applyState();resize();
  },undefined,()=>{failed=true;message('The 3D model could not load. Use the 2D view or reload to retry.');});
}
function reset(){camera.position.copy(home);controls.target.copy(target);controls.update();invalidate();}
window.Transformer3D={
  mount(next){
    state=next;host=document.querySelector('#model-canvas');if(!host)return;
    try{if(!renderer&&!failed)initialize();}catch(error){failed=true;console.error(error);message('3D graphics are unavailable. Use the 2D view below.');}
    if(failed){message('3D graphics are unavailable. Use the 2D view below.');return;}
    host.append(viewport);observer.observe(host);
    document.querySelector('#model-reset').onclick=reset;
    document.querySelector('#model-zoom-in').onclick=()=>{camera.position.sub(controls.target).multiplyScalar(.85).add(controls.target);controls.update();invalidate();};
    document.querySelector('#model-zoom-out').onclick=()=>{camera.position.sub(controls.target).multiplyScalar(1.15).add(controls.target);controls.update();invalidate();};
    document.querySelector('#model-cutaway').onclick=()=>{cutaway=!cutaway;applyState();};
    if(state.component==='windings'&&previousComponent!=='windings')cutaway=true;
    previousComponent=state.component;
    if(model)message('Illustrative model · Select a part to inspect');applyState();resize();
  },
  unmount(){observer?.disconnect();viewport.remove();host=null;activePointers.clear();start=null;},
};
window.dispatchEvent(new Event('transformer3dready'));
