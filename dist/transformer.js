'use strict';
function transformerDiagram() {
  // All fabricated geometry shares one parallel projection.
  const project=(x,y,z)=>[300+.86*x+.62*y,296+.28*x-.28*y-z];
  const pt=p=>p.map(n=>Number(n.toFixed(2))).join(',');
  const poly=(points,fill,cls='')=>`<polygon class="${cls}" points="${points.map(p=>pt(project(...p))).join(' ')}" fill="${fill}" stroke="#83968d" stroke-width="1.2"/>`;
  const line=(points,color='#8b9d93',width=1.2,extra='')=>`<polyline points="${points.map(p=>pt(project(...p))).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" ${extra}/>`;
  const box=(x,y,z,w,d,h,cls='part-shape')=>poly([[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]],'#edf1ed',cls)+poly([[x+w,y,z],[x+w,y+d,z],[x+w,y+d,z+h],[x+w,y,z+h]],'#bac9c0',cls)+poly([[x,y,z],[x+w,y,z],[x+w,y,z+h],[x,y,z+h]],'#d7e0d9',cls);
  const group=(id,body)=>`<g class="part ${overlay?statusFor(id):'schematic'} ${component===id?'selected':''}" role="button" tabindex="0" aria-label="${COMPONENTS[id].name}: ${statusName(statusFor(id))}" data-select="${id}">${body}</g>`;
  const marker=(x,y)=>`<circle class="ring" cx="${x}" cy="${y}" r="13"/><circle class="hotspot" cx="${x}" cy="${y}" r="6"/>`;
  const label=(id,xyz,text,x,y,side='right')=>{
    const [px,py]=project(...xyz),end=side==='right'?x-10:x+132;
    return group(id,`<path d="M${px} ${py}H${end- (side==='right'?16:-16)}L${end} ${y-4}H${side==='right'?x-5:x+126}" fill="none" stroke="#afbbb3" stroke-width="1"/>${marker(px,py)}<text x="${x}" y="${y}" class="equipment-label">${text}</text>`);
  };
  const bushing=(x,y,h)=>{
    const [px,py]=project(x,y,151);
    const ribs=Array.from({length:Math.floor((h-13)/7)},(_,i)=>{const cy=-12-i*7,r=14-i*.27;return `<ellipse cx="0" cy="${cy}" rx="${r}" ry="3.5" fill="#b6c2b9" stroke="#71867a" stroke-width=".85"/>`;}).join('');
    return `<g transform="translate(${px} ${py})"><ellipse cx="0" cy="3" rx="19" ry="6" fill="#d6dfd8" stroke="#83968d"/><path d="M-6 0V-${h}H6V0" fill="#abbab0" stroke="#71867a"/>${ribs}<rect x="-3" y="-${h+10}" width="6" height="13" rx="1" fill="#71867a"/></g>`;
  };
  const coils=Array.from({length:11},(_,i)=>`<ellipse cx="52" cy="${-47-i*5}" rx="11" ry="3"/><ellipse cx="88" cy="${-47-i*5}" rx="11" ry="3"/>`).join('');
  const cylinder=(x,y,z,length,radius)=>{
    const ring=ax=>Array.from({length:64},(_,i)=>project(ax,y+radius*Math.cos(i*Math.PI/32),z+radius*Math.sin(i*Math.PI/32)));
    const points=[...ring(x),...ring(x+length)].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
    const half=arr=>{const hull=[];for(const p of arr){while(hull.length>=2&&cross(hull.at(-2),hull.at(-1),p)<=0)hull.pop();hull.push(p);}return hull.slice(0,-1);};
    const hull=[...half(points),...half([...points].reverse())];
    return `<polygon class="part-shape" points="${hull.map(pt).join(' ')}" fill="#d8e2d9" stroke="#83968d" stroke-width="1.2"/><polygon class="part-shape" points="${ring(x+length).map(pt).join(' ')}" fill="#bdcec1" stroke="#83968d" stroke-width="1.2"/>`;
  };
  return `<svg class="transformer-drawing" viewBox="0 0 800 430" role="group" aria-label="Power transformer components">
    <g stroke-linejoin="round" stroke-linecap="round">
    ${poly([[-178,-18,-12],[240,-18,-12],[240,144,-12],[-178,144,-12]],'#f0f3ef')}
    ${box(16,8,-7,30,91,13,'')}${box(164,8,-7,30,91,13,'')}
    ${group('tank',box(0,0,6,210,110,138)+box(-5,-5,144,220,120,7)+Array.from({length:5},(_,i)=>line([[111+i*18,0,22],[111+i*18,0,131]],'#a8b9ae',3)).join('')+line([[210,22,22],[210,22,132]],'#9eb2a4',3)+line([[210,87,22],[210,87,132]],'#9eb2a4',3))}
    ${group('windings',`<g transform="matrix(.86 .28 0 1 300 296)"><rect class="part-shape" x="26" y="-124" width="88" height="99" rx="4" fill="#e9eee3" fill-opacity=".88" stroke="#a2b19c" stroke-width="1.2" stroke-dasharray="4 4"/><path d="M39 -40V-107h62v67H39Z" fill="none" stroke="#b1bba8" stroke-width="7"/><g stroke="#8d9f80" stroke-width="1.3" fill="#d6dfc9">${coils}</g></g>`)}
    ${group('conservator',box(24,62,151,9,16,30,'')+box(85,62,151,9,16,30,'')+cylinder(9,70,200,96,19))}
    ${group('bushings',bushing(124,80,75)+bushing(179,80,75)+bushing(82,18,43))}
    ${group('tapchanger',box(210,24,43,33,49,73)+poly([[244,33,60],[244,63,60],[244,63,98],[244,33,98]],'#d5dfd5')+line([[244,39,78],[244,47,78]],'#738b79',2))}
    ${group('cooling',
      box(-154,8,-7,13,37,19,'')+box(-91,8,-7,13,37,19,'')+
      line([[-67,0,56],[0,0,56]],'#8da397',5)+
      line([[-67,0,31],[0,0,31]],'#8da397',5)+
      box(-167,0,12,100,55,64)+
      Array.from({length:7},(_,i)=>line([[-157+i*12,0,24],[-157+i*12,0,66]],'#aabcb0',2)).join(''))}
    </g>
    <g class="equipment-callouts">
      ${label('conservator',[55,53,200],'Oil conservator',36,65,'left')}
      ${label('bushings',[179,80,210],'HV / LV bushings',606,92)}
      ${label('cooling',[-119,0,48],'Oil / water cooling',26,180,'left')}
      ${label('tapchanger',[243,49,88],'Tap equipment',606,232)}
      ${label('tank',[170,0,30],'Main tank & oil',606,331)}
      ${(()=>{const [x,y]=project(69,0,75);return group('windings',`<path d="M${x} ${y}V378" fill="none" stroke="#afbbb3" stroke-width="1"/>${marker(x,y)}<text x="${x}" y="398" text-anchor="middle" class="equipment-label">Core &amp; windings</text>`);})()}
    </g>
  </svg>`;
}
