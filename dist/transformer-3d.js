import * as THREE from 'three';
import { OrbitControls } from './vendor/three/OrbitControls.js';
import { GLTFLoader } from './vendor/three/GLTFLoader.js';
import { componentOf, firstVisibleComponent, selectionGesture } from './model-selection.mjs';

// Retain a single renderer and camera across dashboard updates.
let renderer, scene, camera, controls, model, observer, host, state, failed=false;
let previousComponent=null, cutaway=true, hovered=null, frame=0;
const gesture=selectionGesture();
const viewport=document.createElement('div');viewport.className='model-viewport';
const tooltip=document.createElement('div');tooltip.className='model-tooltip';tooltip.hidden=true;tooltip.id='model-tag-tooltip';tooltip.setAttribute('role','tooltip');
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
const home=new THREE.Vector3(6.5,6,10),target=new THREE.Vector3(-.7,2,0);
function draw(){frame=0;if(renderer&&host?.isConnected)renderer.render(scene,camera);}
function invalidate(){if(!frame)frame=requestAnimationFrame(draw);}
function resize(){
  if(!host)return;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
  renderer.setSize(w,h);
  // Preserve parallel projection; fit the assembly on narrow viewports too.
  const aspect=w/h,halfHeight=Math.max(3.1,4.5/aspect);
  camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;
  camera.updateProjectionMatrix();invalidate();
}
function message(text){const el=document.querySelector('#model-message');if(el)el.textContent=text;}
function selectionMessage(){message(`Orthographic · ${state.names[state.component]} selected`);}
function applyState(){
  if(!model||!state)return;
  model.traverse(obj=>{
    if(!obj.isMesh)return;
    const id=componentOf(obj),selected=id===state.component;
    obj.visible=!(cutaway&&obj.userData.hideInCutaway===true);
    const m=obj.material;m.color.copy(obj.userData.baseColor);m.emissive.setHex(0x000000);
    if(state.overlay&&state.statuses[id]==='watch')m.color.lerp(new THREE.Color('#af873f'),.27);
    if(selected){m.emissive.set('#42667b');m.emissiveIntensity=.16;}
    if(id===hovered){m.emissive.set('#557f95');m.emissiveIntensity=.3;}
    const edge=obj.userData.cadEdges;
    if(edge){edge.material.color.set(selected?'#416b83':id===hovered?'#6994ad':'#26333e');edge.material.opacity=selected?.8:.38;}
  });
  const c=document.querySelector('#model-cutaway');if(c){c.setAttribute('aria-pressed',String(cutaway));c.textContent=cutaway?'Cutaway on':'Cutaway off';}
  invalidate();
}
function pick(event){
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  // Raycast only after current camera/model transforms are committed.
  camera.updateMatrixWorld();model.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);
  return firstVisibleComponent(raycaster.intersectObject(model,true),state.statuses);
}
function showHover(id,x,y){
  if(id!==hovered){hovered=id;applyState();}
  tooltip.hidden=!id;if(!id)return;
  // HTML is escaped by the shared dashboard formatter, never built from raw imports here.
  if(tooltip.dataset.component!==id){tooltip.innerHTML=state.hoverCards[id];tooltip.dataset.component=id;}
  tooltip.style.width=Math.min(310,host.clientWidth-16)+'px';
  const w=tooltip.offsetWidth,h=tooltip.offsetHeight;
  const left=x+w+18>host.clientWidth?x-w-14:x+14;
  const top=y-h-12<8?y+16:y-h-12;
  tooltip.style.left=Math.max(8,Math.min(left,host.clientWidth-w-8))+'px';
  tooltip.style.top=Math.max(8,Math.min(top,host.clientHeight-h-8))+'px';
}
function clearHover(){hovered=null;tooltip.hidden=true;if(renderer)renderer.domElement.style.cursor='grab';applyState();}
function zoom(factor){camera.zoom=THREE.MathUtils.clamp(camera.zoom*factor,.65,3);camera.updateProjectionMatrix();controls.update();invalidate();}
function reset(){camera.position.copy(home);camera.zoom=1;camera.updateProjectionMatrix();controls.target.copy(target);controls.update();invalidate();}
function initialize(){
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  viewport.append(renderer.domElement,tooltip);
  const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','Interactive transformer. Click a component to view its details. Drag to rotate; scroll or use plus and minus to zoom. Arrow keys rotate.');
  scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-5,5,3.1,-3.1,.1,100);camera.position.copy(home);
  controls=new OrbitControls(camera,canvas);controls.target.copy(target);controls.minZoom=.65;controls.maxZoom=3;controls.maxPolarAngle=Math.PI*.49;
  controls.enablePan=false;controls.update();controls.addEventListener('change',invalidate);
  scene.add(new THREE.HemisphereLight(0xffffff,0x8793a0,1.8));
  const sun=new THREE.DirectionalLight(0xffffff,2.5);sun.position.set(4,10,6);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:.5,far:30});sun.shadow.normalBias=.025;
  scene.add(sun);
  const fill=new THREE.DirectionalLight(0xe3eaf2,1.2);fill.position.set(-6,4,-5);scene.add(fill);
  const grid=new THREE.GridHelper(18,36,0xb0bbc5,0xd8dfe5);grid.position.y=-.255;grid.material.transparent=true;grid.material.opacity=.45;scene.add(grid);
  // Capture gestures independently of OrbitControls; select only on a completed tap.
  canvas.addEventListener('pointerdown',e=>gesture.down(e),true);
  canvas.addEventListener('pointermove',e=>{
    gesture.move(e);
    if(gesture.active){if(hovered)clearHover();return;}
    if(!model)return;const id=pick(e);
    canvas.style.cursor=id?'pointer':'grab';showHover(id,e.offsetX,e.offsetY);
  });
  canvas.addEventListener('pointerup',e=>{
    if(!gesture.up(e)||!model)return;const id=pick(e);if(!id)return;
    // Defer the DOM update until OrbitControls has released its pointer capture.
    requestAnimationFrame(()=>{if(!host?.isConnected)return;clearHover();if(id==='windings')cutaway=true;state.onSelect(id);});
  });
  canvas.addEventListener('pointercancel',()=>{gesture.clear();clearHover();});
  canvas.addEventListener('pointerleave',()=>clearHover());
  canvas.addEventListener('keydown',e=>{
    if(e.key==='Escape'){clearHover();return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key))return;
    e.preventDefault();clearHover();if(e.key==='Home'){reset();return;}if(e.key==='+'||e.key==='='){zoom(1.15);return;}if(e.key==='-'){zoom(1/1.15);return;}
    const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if(e.key==='ArrowLeft')s.theta-=.13;if(e.key==='ArrowRight')s.theta+=.13;
    if(e.key==='ArrowUp')s.phi=Math.max(.1,s.phi-.13);if(e.key==='ArrowDown')s.phi=Math.min(Math.PI*.49,s.phi+.13);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));controls.update();invalidate();
  });
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();failed=true;message('3D graphics paused. Reload to retry, or use the 2D view.');});
  observer=new ResizeObserver(resize);
  new GLTFLoader().load('./models/transformer.glb?v=cad2',gltf=>{
    model=gltf.scene;
    const meshes=[];model.traverse(obj=>{if(obj.isMesh)meshes.push(obj);});
    for(const obj of meshes){
      obj.material=obj.material.clone();obj.userData.baseColor=obj.material.color.clone();obj.castShadow=true;obj.receiveShadow=true;
      if(!/Copper_winding_turn|Porcelain_shed|Porcelain_stem/.test(obj.name)){
        const lines=new THREE.LineSegments(new THREE.EdgesGeometry(obj.geometry,35),new THREE.LineBasicMaterial({color:0x26333e,transparent:true,opacity:.38}));
        lines.raycast=()=>{};obj.add(lines);obj.userData.cadEdges=lines;
      }
    }
    scene.add(model);selectionMessage();applyState();resize();
  },undefined,()=>{failed=true;message('The 3D model could not load. Use the 2D view or reload to retry.');});
}
window.Transformer3D={
  mount(next){
    state=next;tooltip.dataset.component='';host=document.querySelector('#model-canvas');if(!host)return;
    try{if(!renderer&&!failed)initialize();}catch(error){failed=true;console.error(error);}
    if(failed){message('3D graphics are unavailable. Use the 2D view below.');return;}
    host.append(viewport);observer.observe(host);
    // Keyboard users can preview the same card by focusing a component button.
    document.querySelectorAll('.model-component').forEach(button=>{
      button.setAttribute('aria-describedby',tooltip.id);
      button.onfocus=()=>showHover(button.dataset.select,host.clientWidth/2,host.clientHeight-10);
      button.onblur=clearHover;
      button.onkeydown=e=>{if(e.key==='Escape')clearHover();};
    });
    document.querySelector('#model-reset').onclick=reset;
    document.querySelector('#model-zoom-in').onclick=()=>zoom(1.15);
    document.querySelector('#model-zoom-out').onclick=()=>zoom(1/1.15);
    document.querySelector('#model-cutaway').onclick=()=>{cutaway=!cutaway;clearHover();applyState();};
    if(state.component==='windings'&&previousComponent!=='windings')cutaway=true;
    previousComponent=state.component;
    if(model)selectionMessage();applyState();resize();
  },
  unmount(){observer?.disconnect();viewport.remove();host=null;gesture.clear();hovered=null;tooltip.hidden=true;},
};
window.dispatchEvent(new Event('transformer3dready'));
