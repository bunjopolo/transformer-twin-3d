// Shared geometry/gesture rules, independent of rendering and dashboard state.
export function componentOf(object) {
  for (let node=object;node;node=node.parent) if(node.userData?.component)return node.userData.component;
  return null;
}
export function visibleInHierarchy(object) {
  for(let node=object;node;node=node.parent)if(node.visible===false)return false;
  return true;
}
export function firstVisibleComponent(hits,statuses) {
  // Edges are visual aids only. Hidden panels must never intercept a click.
  const hit=hits.find(hit=>hit.object.isMesh&&visibleInHierarchy(hit.object));
  const id=hit&&componentOf(hit.object);
  return id&&Object.hasOwn(statuses,id)?id:null;
}
export function selectionGesture() {
  const pointers=new Set();let start=null,dragged=false;
  return {
    down(e){pointers.add(e.pointerId);if(pointers.size>1)dragged=true;else{start=[e.clientX,e.clientY];dragged=false;}},
    move(e){if(start&&Math.hypot(e.clientX-start[0],e.clientY-start[1])>6)dragged=true;},
    up(e){this.move(e);const click=!!start&&!dragged&&pointers.size===1&&e.button===0;pointers.delete(e.pointerId);if(!pointers.size)start=null;return click;},
    clear(){pointers.clear();start=null;dragged=true;},
    get active(){return pointers.size>0;}
  };
}
