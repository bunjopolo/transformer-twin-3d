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
function duvalAnalyze(values){
  if(values.length!==3||values.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0))return {valid:false,reason:'Three finite, non-negative gas concentrations are required.'};
  const total=values.reduce((a,b)=>a+b,0);
  if(!Number.isFinite(total)||total<=0)return {valid:false,reason:'The three-gas total is zero or invalid; no point can be plotted.'};
  const percentages=values.map(v=>v/total*100);
  const zones=DUVAL_ZONES.filter(z=>duvalContains(percentages,z.vertices));
  return {valid:zones.length>0,total,percentages,zones:zones.map(z=>z.id),boundary:zones.length>1};
}
function dgaSeries(rows,mapping){
  const tags=['DGA-CH4','DGA-C2H4','DGA-C2H2'].map(k=>mapping[k]);
  if(tags.some(t=>!t)||new Set(tags).size!==3)return [];
  const samples=new Map();
  for(const row of rows){const i=tags.indexOf(row.tag);if(i<0)continue;const time=Date.parse(row.timestamp);if(!Number.isFinite(time))continue;
    if(!samples.has(time))samples.set(time,{time,timestamp:new Date(time).toISOString(),rows:[null,null,null],duplicate:false});
    const sample=samples.get(time);if(sample.rows[i])sample.duplicate=true;sample.rows[i]=row;
  }
  return [...samples.values()].sort((a,b)=>a.time-b.time).map(s=>{
    if(s.duplicate)return {...s,valid:false,reason:'Duplicate gas readings at this timestamp.'};
    if(s.rows.some(r=>!r))return {...s,valid:false,reason:'Missing simultaneous methane, ethylene or acetylene reading.'};
    if(s.rows.some(r=>String(r.unit).trim().toLowerCase()!=='ppm'))return {...s,valid:false,reason:'Triangle inputs must all use ppm. Check tag mapping and import units.'};
    return {...s,...duvalAnalyze(s.rows.map(r=>r.actual))};
  });
}
function replayAdvance(time,elapsed,speed,end){return Math.min(end,time+Math.max(0,elapsed)*speed)}
if(typeof module!=='undefined')module.exports={DUVAL_ZONES,duvalAnalyze,dgaSeries,replayAdvance};
