'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const d=require('./dist/duval.js');
let checked=0;
const definitions=[['t1','mineral'],['t2','mineral'],...Object.keys(d.DUVAL_FLUIDS).map(f=>['t3',f]),['t4','mineral'],['t5','mineral']];
for(const [id,fluid] of definitions){
  for(let a=0;a<=100;a++)for(let b=0;b<=100-a;b++){
    const r=d.duvalAnalyze([a,b,100-a-b],id,fluid);assert.ok(r.valid,`${id}/${fluid}: uncovered ${a},${b}`);checked++;
  }
  for(const z of d.duvalMethod(id,fluid).zones)for(const p of z.polygons||[z.vertices])for(const v of p){
    assert.ok(Math.abs(v.reduce((a,b)=>a+b)-100)<1e-8);assert.ok(d.duvalAnalyze(v,id,fluid).zones.includes(z.id),`${id} vertex ${z.id}`);
  }
}
for(const c of require('./test-duval-reference.json').cases){
  const r=d.duvalAnalyze(c.values,c.method,c.fluid);
  assert.deepEqual([...r.zones].sort(),[...c.expected].sort(),JSON.stringify(c));
  assert.deepEqual(d.duvalAnalyze(c.values.map(v=>v*27.3),c.method,c.fluid).zones,r.zones);
}
// Independently published IEEE Spring 2025 correction examples: every named
// reference region must be reported, with adjacent regions retained on edges.
const corrections4=[[[9,0,91],'O'],[[9,21,70],'O'],[[9,45,46],'O'],[[9,51,40],'O'],[[9,61,30],'C'],[[0,70,30],'C'],[[15,55,30],'C'],[[15,61,24],'C'],[[26,50,24],'C'],[[40,36,24],'C'],[[54,36,10],'C'],[[64,36,0],'C'],[[85,15,0],'PD'],[[84,15,1],'PD'],[[91,8,1],'PD'],[[97,2,1],'PD']];
const corrections5=[[[78,10,12],'T2'],[[63,25,12],'T2'],[[53,35,12],'T2'],[[59,35,6],'T2'],[[65,35,0],'T2'],[[43,45,12],'T3'],[[37,49,14],'T3'],[[36,50,14],'T3'],[[21,65,14],'T3'],[[10,70,20],'C'],[[85,1,14],'PD'],[[86,0,14],'PD'],[[97,1,2],'PD']];
for(const [id,cases] of [['t4',corrections4],['t5',corrections5]])for(const [v,z] of cases)assert.ok(d.duvalAnalyze(v,id).zones.includes(z),`${id} correction ${v}: ${z}`);
assert.deepEqual(d.duvalAnalyze([15,60,25],'t4').zones,['S','C']);
assert.deepEqual(d.duvalAnalyze([15.001,59.999,25],'t4').zones,['S']);
assert.deepEqual(d.duvalAnalyze([14.999,60.001,25],'t4').zones,['C']);
// Narrow source-workbook omissions are resolved by the published 2008 geometry.
assert.deepEqual(d.duvalAnalyze([1,83,16],'t3','biotemp').zones,['DT']);
for(const id of ['p1','p2']){
  const equal=d.duvalAnalyze([20,20,20,20,20],id);assert.ok(equal.valid);assert.ok(equal.point.every(v=>Math.abs(v)<1e-12));
  const example=d.duvalAnalyze([50,80,120,60,30],id);assert.ok(Math.abs(example.point[0]+7.35)<.02);assert.ok(Math.abs(example.point[1]+5.79)<.02);
  assert.deepEqual(example.zones,[id==='p1'?'T1':'C']);
  for(const z of d.duvalMethod(id).zones){assert.ok(d.duvalClassify(z.label,d.duvalMethod(id).zones).includes(z.id));for(const v of z.vertices)assert.ok(d.duvalClassify(v,d.duvalMethod(id).zones).includes(z.id));}
  assert.ok(d.duvalAnalyze([100,0,0,0,0],id).reason.includes('detection-limit'));
  assert.ok(d.duvalAnalyze([1,2,3,4,0],id).reason.includes('detection-limit'));
  // Positive compositions, including strongly dominant gases, remain finite.
  for(let seed=1;seed<1000;seed++){
    const v=[2,3,5,7,11].map(k=>.1+(seed*k*k%997));const r=d.duvalAnalyze(v,id);assert.ok(r.valid);assert.ok(r.point.every(Number.isFinite));
    const scaled=d.duvalAnalyze(v.map(x=>x*10000),id);assert.deepEqual(scaled.zones,r.zones);assert.ok(scaled.point.every((x,i)=>Math.abs(x-r.point[i])<1e-10));
  }
}
assert.equal(d.duvalCentroid([100,0,0,0,0]),null);
for(const [id,m] of Object.entries(d.DUVAL_METHODS))for(const invalid of [null,[],Array(m.gases.length).fill(0),Array(m.gases.length).fill(NaN),[-1,...Array(m.gases.length-1).fill(1)],['1',...Array(m.gases.length-1).fill(1)]])assert.equal(d.duvalAnalyze(invalid,id,'fr3').valid,false);
const mapping=Object.fromEntries(['H2','CH4','C2H2','C2H4','C2H6'].map(g=>['DGA-'+g,g]));
function rows(values={H2:42,CH4:20,C2H2:.4,C2H4:11,C2H6:8},timestamp='2026-11-16T10:00:00Z'){return Object.entries(values).map(([tag,actual])=>({tag,actual,unit:'ppm',timestamp}));}
const input=rows();
for(const id of ['t1','t4','t5','p1','p2'])assert.ok(d.dgaSeries(input,mapping,id)[0].valid,id);
assert.equal(d.dgaSeries(input,mapping,'t2')[0].valid,false);
assert.equal(d.dgaSeries(input,mapping,'t2','ltc')[0].valid,true);
assert.equal(d.dgaSeries(rows({CH4:100,C2H4:1,C2H2:1}),mapping,'t2','ltc')[0].valid,false);
assert.equal(d.dgaSeries(input,mapping,'t3')[0].valid,false);
for(const fluid of Object.keys(d.DUVAL_FLUIDS))assert.ok(d.dgaSeries(input,mapping,'t3',fluid)[0].valid);
for(const id of ['t4','t5']){
  assert.equal(d.dgaSeries(rows({H2:50,CH4:20,C2H2:40,C2H4:40,C2H6:20}),mapping,id)[0].valid,false);
  assert.equal(d.dgaSeries(input.filter(r=>r.tag!=='C2H2'),mapping,id)[0].valid,false,'prerequisite must share timestamp');
  assert.equal(d.dgaSeries([...input,...rows({C2H2:.5},'2026-11-16T11:00:00Z')],mapping,id).at(-1).valid,false,'new incomplete prerequisite clears old sample');
  assert.equal(d.dgaSeries([...input,input.find(r=>r.tag==='C2H2')],mapping,id)[0].valid,false);
  assert.equal(d.dgaSeries(input,{...mapping,'DGA-C2H2':''},id).length,0);
}
for(const id of ['t4','t5','p1','p2']){
  assert.equal(d.dgaSeries(input.map(r=>({...r,unit:'ppm/month'})),mapping,id)[0].valid,false);
  assert.equal(d.dgaSeries([...input,input[0]],mapping,id)[0].valid,id==='t5','duplicate irrelevant gas does not invalidate other methods');
  assert.equal(d.dgaSeries(input.map((r,i)=>({...r,timestamp:i?'2026-11-16T02:00:00-08:00':r.timestamp})),mapping,id)[0].valid,true);
}
assert.equal(d.dgaSeries(rows({H2:50,CH4:99,C2H4:.5,C2H2:.5,C2H6:8}),mapping,'t5')[0].valid,false,'PD does not qualify for Triangle 5');
assert.equal(d.dgaSeries(rows({H2:50,CH4:20,C2H4:70,C2H2:10,C2H6:8}),mapping,'t4')[0].valid,false,'T3 does not qualify for Triangle 4');
assert.equal(d.dgaSeries(rows({H2:50,CH4:76,C2H4:20,C2H2:4,C2H6:8}),mapping,'t4')[0].valid,false,'DT boundary cannot establish applicability');
const ctx=vm.createContext({Date,structuredClone,setTimeout,clearTimeout,clearInterval,console,localStorage:{getItem:()=>null,setItem:()=>{}}});
for(const f of ['tag-catalog','smartsignal','duval','dga'])vm.runInContext(fs.readFileSync(`dist/${f}.js`,'utf8'),ctx);
const app=fs.readFileSync('dist/app.js','utf8');vm.runInContext(app.slice(0,app.lastIndexOf("document.querySelectorAll('.nav')")),ctx);
const run=source=>vm.runInContext(source,ctx);
const html=run('dgaFrame(dgaModel())');
for(const id of ['t1','t2','t4','t5','p1','p2',...Object.keys(d.DUVAL_FLUIDS).map(f=>'t3-'+f)])assert.ok(html.includes(`data-duval-card="${id}"`),id);
assert.equal((html.match(/class="duval-svg"/g)||[]).length,10,'all diagrams render together');
assert.ok(!html.includes('NaN'));assert.ok(!html.includes('undefined'));
assert.ok(html.includes('Comparison reference'));assert.ok(html.includes('conventional oil-arcing LTC'));
assert.ok(!run('dgaPage()').includes('id="dga-method"'));assert.ok(!run('dgaPage()').includes('Imported sample source'));
run('dgaTime=dgaModel().start');assert.ok(run('dgaModel().views.every(v=>v.sample.time===dgaTime)'));
run('dgaTime+=1800000');assert.ok(run('dgaModel().views.every(v=>v.sample.time===dgaTime-1800000)'));
assert.ok(run('dgaModel().views[0].series===dgaModel().views[0].series'),'replay reuses classification series');
run('dgaTime=dgaModel().end;data.sensors=[...data.sensors,{...data.sensors.find(r=>r.tag===dgaMapping()["DGA-H2"]),timestamp:new Date(dgaTime+3600000).toISOString(),actual:50}];dgaTime=null');
assert.ok(run('dgaModel().views.filter(v=>["t4","p1","p2"].includes(v.id)).every(v=>!v.sample.valid)'),'incomplete newer H2 sample clears affected charts');
assert.ok(run('dgaModel().views.find(v=>v.id==="t1").sample.valid'),'irrelevant gas does not invalidate Triangle 1');
run('data.dgaMappings={...dgaMapping(),"DGA-C2H6":""}');
assert.ok(run('dgaModel().views.filter(v=>["t4","t5","p1","p2"].includes(v.id)).every(v=>v.series.length===0)'),'mapping changes invalidate cached results');
run('dgaReset()');assert.equal(run('dgaTime'),null);assert.equal(run('dgaSeriesCache'),null);
console.log(`PASS: ${checked} lattice compositions, 280 independent workbook fixtures, 29 published correction cases, pentagon centroids, all fluid variants, applicability, missing/duplicate data and UI rendering.`);
