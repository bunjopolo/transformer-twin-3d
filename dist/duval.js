'use strict';
// Triangle 1, mineral oil. Coordinates ordered CH4, C2H4, C2H2 (%).
// Source: Int. J. Electrical and Power Engineering 4(3), 193–197 (2010), Table 3.
// https://www.makhillpublications.co/public/files/published-files/mak-ijepe/2010/3-193-197.pdf
const DUVAL_ZONES = [
  {id:'PD',name:'Partial discharges',color:'#b9cfdc',label:[99,0.5,0.5],vertices:[[98,2,0],[100,0,0],[98,0,2]]},
  {id:'D1',name:'Low-energy discharges',color:'#a5c5d6',label:[27,10,63],vertices:[[0,0,100],[0,23,77],[64,23,13],[87,0,13]]},
  {id:'D2',name:'High-energy discharges',color:'#aaaed1',label:[20,43,37],vertices:[[0,23,77],[0,71,29],[31,40,29],[47,40,13],[64,23,13]]},
  {id:'DT',name:'Thermal + electrical discharges',color:'#d3c6ac',label:[57,35,8],vertices:[[0,71,29],[0,85,15],[35,50,15],[46,50,4],[96,0,4],[87,0,13],[47,40,13],[31,40,29]]},
  {id:'T1',name:'Thermal fault below 300 °C',color:'#dbe1a6',label:[89,9,2],vertices:[[76,20,4],[80,20,0],[98,2,0],[98,0,2],[96,0,4]]},
  {id:'T2',name:'Thermal fault 300–700 °C',color:'#edd197',label:[63,35,2],vertices:[[46,50,4],[50,50,0],[80,20,0],[76,20,4]]},
  {id:'T3',name:'Thermal fault above 700 °C',color:'#dfa695',label:[16,77,7],vertices:[[0,85,15],[0,100,0],[50,50,0],[35,50,15]]}
];
function duvalContains(point,vertices){
  const [x,y]=point;let inside=false;
  for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
    const [ax,ay]=vertices[j],[bx,by]=vertices[i];
    const cross=(x-ax)*(by-ay)-(y-ay)*(bx-ax);
    if(Math.abs(cross)<1e-8&&x>=Math.min(ax,bx)-1e-9&&x<=Math.max(ax,bx)+1e-9&&y>=Math.min(ay,by)-1e-9&&y<=Math.max(ay,by)+1e-9)return true;
    if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  }return inside;
}
// Versioned definitions and verification notes: DUVAL-METHODS.md.
const DUVAL_REFERENCE='https://standards.ieee.org/content/dam/ieee-standards/standards/web/download/C57.104-2019_downloads.zip';
const DUVAL_GASES={H2:['H₂','Hydrogen'],CH4:['CH₄','Methane'],C2H6:['C₂H₆','Ethane'],C2H4:['C₂H₄','Ethylene'],C2H2:['C₂H₂','Acetylene']};
const DUVAL_FLUIDS={silicone:{name:'Silicone',limits:[9,16,46]},midel:{name:'MIDEL 7131',limits:[26,39,68]},fr3:{name:'FR3',limits:[25,43,63]},biotemp:{name:'BIOTEMP',limits:[20,52,82]}};
const DUVAL_NAMES=Object.fromEntries(DUVAL_ZONES.map(z=>[z.id,z.name]));
Object.assign(DUVAL_NAMES,{N:'Normal operation region',X1:'Abnormal arcing or developing thermal fault',X3:'Developing thermal fault or high-energy arcing',S:'Stray gassing of mineral oil',O:'Overheating below 250 °C',C:'Possible paper carbonization',ND:'Not determined','T3-H':'Thermal fault above 700 °C in oil only'});
const DUVAL_COLORS={...Object.fromEntries(DUVAL_ZONES.map(z=>[z.id,z.color])),N:'#c5dbc3',X1:'#c9c6ad',X3:'#c2b8d3',S:'#c8d9bd',O:'#e3dda9',C:'#dcae9e',ND:'#e3e8e4','T3-H':'#dfa695'};
function duvalZone(id,vertices,label,name){return {id,name:name||DUVAL_NAMES[id],color:DUVAL_COLORS[id],vertices,label};}
// Clip a simplex by bounds on its three gas percentages; avoids extrapolated
// vertices outside the triangle for fluid-specific limits (notably BIOTEMP).
function duvalClip(bounds){
  let p=[[100,0,0],[0,100,0],[0,0,100]];
  for(const [axis,low,high] of bounds)for(const [limit,sign] of [[low,1],[high,-1]]){
    if(limit==null)continue;const out=[];
    for(let i=0;i<p.length;i++){
      const a=p[i],b=p[(i+1)%p.length],da=sign*(a[axis]-limit),db=sign*(b[axis]-limit);
      if(da>=0)out.push(a);
      if((da>=0)!==(db>=0)){const t=da/(da-db);out.push(a.map((v,j)=>v+t*(b[j]-v)));}
    }p=out;
  }return p;
}
function duvalFluidZones(fluid){
  if(!DUVAL_FLUIDS[fluid])return [];
  const [d,b,c]=DUVAL_FLUIDS[fluid].limits;
  const definitions=[
    ['PD',[[0,98,null]]],['D1',[[1,null,d],[2,13,null]]],
    ['D2',[[1,d,40],[2,13,29]]],['D2',[[1,d,null],[2,29,null]]],
    ['DT',[[1,null,c],[2,4,13]]],['DT',[[1,40,null],[2,15,29]]],['DT',[[1,40,c],[2,13,15]]],
    ['T1',[[0,null,98],[1,null,b],[2,null,4]]],['T2',[[1,b,c],[2,null,4]]],['T3',[[1,c,null],[2,null,15]]]
  ];
  return ['PD','D1','D2','DT','T1','T2','T3'].map(id=>{
    const polygons=definitions.filter(d=>d[0]===id).map(d=>duvalClip(d[1]));
    const labels={PD:[99,.5,.5],D1:[25,d/2,75-d/2],D2:[20,40,40],DT:[92-(40+c)/2,(40+c)/2,8],T1:[98-b/2,b/2,2],T2:[98-(b+c)/2,(b+c)/2,2],T3:[(100-c)/3,100-7-(100-c)/3,7]};
    return {...duvalZone(id,polygons[0],labels[id]),polygons};
  });
}
const DUVAL_TRIANGLE2=[
  duvalZone('N',[[19,6,75],[19,23,58],[2,23,75],[2,6,92]],[10,14,76]),
  duvalZone('D1',[[0,0,100],[19,0,81],[19,6,75],[2,6,92],[2,23,75],[0,23,77]],[8,3,89],'Abnormal low-energy arcing'),
  duvalZone('X1',[[19,0,81],[100,0,0],[77,23,0],[19,23,58]],[60,12,28]),
  duvalZone('X3',[[0,23,77],[62,23,15],[0,85,15]],[23,40,37]),
  duvalZone('T2',[[77,23,0],[50,50,0],[35,50,15],[62,23,15]],[57,36,7],'Thermal fault 300–700 °C; contact coking'),
  duvalZone('T3',[[50,50,0],[0,100,0],[0,85,15],[35,50,15]],[19,74,7],'Thermal fault above 700 °C; heavy contact coking')
];
const DUVAL_TRIANGLE4=[
  duvalZone('PD',[[98,2,0],[85,15,0],[84,15,1],[97,2,1]],[91.5,8,.5]),
  duvalZone('S',[[100,0,0],[98,2,0],[97,2,1],[84,15,1],[85,15,0],[64,36,0],[40,36,24],[15,61,24],[15,55,30],[9,61,30],[9,45,46],[54,0,46]],[58,22,20]),
  duvalZone('C',[[64,36,0],[0,100,0],[0,70,30],[15,55,30],[15,61,24],[40,36,24]],[25,61,14]),
  duvalZone('O',[[0,70,30],[9,61,30],[9,0,91],[0,0,100]],[4,35,61]),
  duvalZone('ND',[[9,0,91],[9,45,46],[54,0,46]],[25,15,60])
];
const duvalEC=points=>points.map(([e,c])=>[100-e-c,e,c]);
const DUVAL_TRIANGLE5=[
  duvalZone('PD',duvalEC([[0,2],[1,2],[1,15],[0,15]]),[91.5,.5,8]),
  {...duvalZone('O',duvalEC([[0,0],[10,0],[10,15],[1,15],[1,2],[0,2]]),[88,6,6]),polygons:[duvalEC([[0,0],[10,0],[10,15],[1,15],[1,2],[0,2]]),duvalEC([[0,54],[10,54],[10,90],[0,100]])],extraLabels:[[25,5,70]]},
  duvalZone('S',duvalEC([[0,15],[10,15],[10,54],[0,54]]),[60,5,35]),
  duvalZone('T2',duvalEC([[10,0],[35,0],[35,12],[10,12]]),[72,22,6]),
  {...duvalZone('T3',duvalEC([[35,0],[100,0],[70,30],[70,14],[49,14],[49,12],[35,12]]),[26,67,7]),polygons:[duvalEC([[35,0],[100,0],[70,30],[70,14],[49,14],[49,12],[35,12]]),duvalEC([[35,30],[70,30],[35,65]])],extraLabels:[[12,45,43]]},
  duvalZone('C',duvalEC([[10,12],[49,12],[49,14],[70,14],[70,30],[10,30]]),[38,40,22]),
  duvalZone('ND',duvalEC([[10,30],[35,30],[35,65],[10,90]]),[25,22,53])
];
// These vertices follow the August 2016 workbook distributed by IEEE.
// Keep this edition coherent; do not mix its coordinates with rounded printed
// tables or proposed 2025 outer-edge corrections.
const DUVAL_PENTAGON_COMMON=[
  duvalZone('PD',[[0,24.5],[-1,24.5],[-1,33],[0,33]],[-.5,28]),
  duvalZone('D1',[[0,40],[38,12],[32,-6],[4,16],[0,1.5]],[13,17]),
  duvalZone('D2',[[4,16],[32,-6],[24,-30],[0,-3],[0,1.5]],[15,-6]),
  duvalZone('S',[[0,40],[-38,12.4],[-35,3],[0,1.5],[0,24.5],[-1,24.5],[-1,33],[0,33]],[-15,17])
];
const DUVAL_PENTAGON1=[...DUVAL_PENTAGON_COMMON,
  duvalZone('T1',[[-35,3],[-22.5,-32],[-6,-4],[0,-3],[0,1.5]],[-19,-6]),
  duvalZone('T2',[[1,-32],[-6,-4],[-22.5,-32]],[-9,-22]),
  duvalZone('T3',[[23.2,-32.4],[24,-30],[0,-3],[-6,-4],[1,-32]],[9,-23])
];
const DUVAL_PENTAGON2=[...DUVAL_PENTAGON_COMMON.map(z=>z.id==='D1'?{...z,vertices:[[0,40],[38,12.4],[32,-6],[4,16],[0,1.5]]}:z),
  duvalZone('O',[[-21.5,-32.4],[-11,-8],[-3.5,-3],[0,-3],[0,1.5],[-35,3],[-23.5,-32.4]],[-20,-8]),
  duvalZone('C',[[2.5,-32.4],[-3.5,-3],[-11,-8],[-21.5,-32.4]],[-8,-22]),
  duvalZone('T3-H',[[24,-30],[0,-3],[-3.5,-3],[2.5,-32.4],[23.5,-32.4]],[12,-24])
];
const DUVAL_METHODS={
  t1:{name:'Duval Triangle 1',gases:['CH4','C2H4','C2H2'],zones:DUVAL_ZONES,scope:'Mineral oil · main tank'},
  t2:{name:'Duval Triangle 2',gases:['CH4','C2H4','C2H2'],zones:DUVAL_TRIANGLE2,scope:'Mineral oil · conventional oil-arcing LTC compartment'},
  t3:{name:'Duval Triangle 3',gases:['CH4','C2H4','C2H2'],zones:[],scope:'Alternative fluid · main tank'},
  t4:{name:'Duval Triangle 4',gases:['H2','CH4','C2H6'],zones:DUVAL_TRIANGLE4,scope:'Mineral oil · Triangle 1: PD, T1 or T2',prerequisite:['PD','T1','T2']},
  t5:{name:'Duval Triangle 5',gases:['CH4','C2H4','C2H6'],zones:DUVAL_TRIANGLE5,scope:'Mineral oil · Triangle 1: T2 or T3',prerequisite:['T2','T3']},
  p1:{name:'Duval Pentagon 1',gases:['H2','C2H6','CH4','C2H4','C2H2'],zones:DUVAL_PENTAGON1,scope:'Mineral oil · main tank · five gases',pentagon:true},
  p2:{name:'Duval Pentagon 2',gases:['H2','C2H6','CH4','C2H4','C2H2'],zones:DUVAL_PENTAGON2,scope:'Mineral oil · main tank · thermal subtypes',pentagon:true}
};
function duvalMethod(id='t1',fluid='mineral'){
  const method=DUVAL_METHODS[id];if(!method)return null;
  return id==='t3'?{...method,zones:duvalFluidZones(fluid),name:method.name+(DUVAL_FLUIDS[fluid]?' · '+DUVAL_FLUIDS[fluid].name:'')}:method;
}
function duvalContextReason(id,context){
  if(id==='t2')return context==='ltc'?'':'Triangle 2 requires a conventional oil-arcing LTC compartment sample. Select that sample source only if it matches the imported data.';
  if(id==='t3')return DUVAL_FLUIDS[context]?'':'Triangle 3 requires a specified alternative insulating fluid. Select the fluid of the imported sample.';
  return context==='mineral'?'':'This method requires a mineral-oil main-tank sample.';
}
function duvalClassify(point,zones){return zones.filter(z=>(z.polygons||[z.vertices]).some(p=>duvalContains(point,p))).map(z=>z.id);}
function duvalCentroid(percentages){
  const points=percentages.map((v,i)=>{const a=(90+i*72)*Math.PI/180;return [v*Math.cos(a),v*Math.sin(a)];});
  let area2=0,x=0,y=0;
  for(let i=0;i<5;i++){const a=points[i],b=points[(i+1)%5],cross=a[0]*b[1]-b[0]*a[1];area2+=cross;x+=(a[0]+b[0])*cross;y+=(a[1]+b[1])*cross;}
  if(!Number.isFinite(area2)||Math.abs(area2)<1e-12)return null;
  return [x/(3*area2),y/(3*area2)];
}
function duvalAnalyze(values,id='t1',fluid='mineral'){
  const method=duvalMethod(id,fluid);
  if(!method)return {valid:false,reason:'Unknown Duval method.'};
  if(!Array.isArray(values)||values.length!==method.gases.length||values.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0))return {valid:false,reason:`${method.gases.length} finite, non-negative gas concentrations are required.`};
  const total=values.reduce((a,b)=>a+b,0);
  if(!Number.isFinite(total)||total<=0)return {valid:false,reason:'The gas total is zero or invalid; no point can be plotted.'};
  if(!method.zones.length)return {valid:false,reason:'Select the alternative fluid for Triangle 3.'};
  // IEEE's workbook asks for laboratory detection limits for zero readings.
  // Never silently invent a 0.1 ppm replacement for a real imported measurement.
  if(method.pentagon&&values.some(v=>v===0))return {valid:false,reason:'Pentagons require positive inputs. For zero / below-detection readings, supply laboratory-approved detection-limit values; no substitute is assumed.'};
  const percentages=values.map(v=>v/total*100),point=method.pentagon?duvalCentroid(percentages):percentages;
  if(!point)return {valid:false,reason:'The gas polygon has zero or numerically unstable area; no centroid can be calculated.'};
  const zones=duvalClassify(point,method.zones);
  return {valid:zones.length>0,total,percentages,point,zones,boundary:zones.length>1,reason:zones.length?'':'The point is outside the reference zone geometry; no region is inferred.'};
}
function dgaAlignedSeries(rows,mapping,gases){
  const tags=gases.map(k=>mapping['DGA-'+k]);
  if(tags.some(t=>!t)||new Set(tags).size!==tags.length)return [];
  const samples=new Map();
  for(const row of rows){const i=tags.indexOf(row.tag);if(i<0)continue;const time=Date.parse(row.timestamp);if(!Number.isFinite(time))continue;
    if(!samples.has(time))samples.set(time,{time,timestamp:new Date(time).toISOString(),rows:Array(tags.length).fill(null),duplicate:false});
    const sample=samples.get(time);if(sample.rows[i])sample.duplicate=true;sample.rows[i]=row;
  }
  return [...samples.values()].sort((a,b)=>a.time-b.time).map(s=>{
    if(s.duplicate)return {...s,valid:false,reason:'Duplicate gas readings at this timestamp.'};
    if(s.rows.some(r=>!r))return {...s,valid:false,reason:'Missing simultaneous '+gases.join(', ')+' reading.'};
    if(s.rows.some(r=>String(r.unit).trim().toLowerCase()!=='ppm'))return {...s,valid:false,reason:'Duval inputs must all use ppm. Check tag mapping and import units.'};
    if(s.rows.some(r=>typeof r.actual!=='number'||!Number.isFinite(r.actual)||r.actual<0))return {...s,valid:false,reason:'Gas readings must be finite, non-negative concentrations.'};
    return {...s,valid:true};
  });
}
function dgaSeries(rows,mapping,id='t1',context='mineral'){
  const method=duvalMethod(id,context);if(!method)return [];
  const gases=[...new Set([...method.gases,...(method.prerequisite?DUVAL_METHODS.t1.gases:[])])];
  return dgaAlignedSeries(rows,mapping,gases).map(s=>{
    const allRows=s.rows,sample={...s,rows:method.gases.map(g=>allRows[gases.indexOf(g)])};
    if(!s.valid)return sample;
    const contextReason=duvalContextReason(id,context);if(contextReason)return {...sample,valid:false,reason:contextReason};
    if(method.prerequisite){
      const primary=duvalAnalyze(DUVAL_METHODS.t1.gases.map(g=>allRows[gases.indexOf(g)].actual));
      if(!primary.valid)return {...sample,valid:false,reason:'A valid simultaneous Triangle 1 result is required.'};
      // A boundary touching an excluded region cannot establish applicability.
      if(!primary.zones.every(z=>method.prerequisite.includes(z)))return {...sample,valid:false,reason:`Not applicable: simultaneous Triangle 1 is ${primary.zones.join(' / ')}. Requires ${method.prerequisite.join(' / ')}.`,primaryZones:primary.zones};
      sample.primaryZones=primary.zones;
    }
    if(id==='t2'&&sample.rows[1].actual<10&&sample.rows[2].actual<10)return {...sample,valid:false,reason:'LTC ethylene and acetylene are both below 10 ppm; the published method advises against diagnosis at these levels.'};
    return {...sample,...duvalAnalyze(sample.rows.map(r=>r.actual),id,context)};
  });
}
function replayAdvance(time,elapsed,speed,end){return Math.min(end,time+Math.max(0,elapsed)*speed)}
if(typeof module!=='undefined')module.exports={DUVAL_ZONES,DUVAL_METHODS,DUVAL_FLUIDS,duvalMethod,duvalAnalyze,duvalClassify,duvalContains,duvalCentroid,duvalContextReason,dgaSeries,replayAdvance};
