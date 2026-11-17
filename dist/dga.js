'use strict';
const DGA_CATALOG=TAG_CATALOG.filter(r=>r[6].startsWith('DGA'));
let dgaTime=null,dgaPlaying=false,dgaSpeed=3600,dgaTimer=null,dgaLastTick=0,dgaTrend='DGA-CH4',dgaControlsOpen=false,dgaSeriesCache=null;
function dgaMapping(){
  const tags=new Map();for(const r of data.sensors)tags.set(r.tag,r);
  return Object.fromEntries(DGA_CATALOG.map(c=>{
    if(Object.hasOwn(data.dgaMappings||{},c[0]))return [c[0],tags.has(data.dgaMappings[c[0]])?data.dgaMappings[c[0]]:''];
    const matches=[...tags.values()].filter(r=>(catalogTag(r.tag)||catalogTag(r.name))?.[0]===c[0]);
    return [c[0],matches.length===1?matches[0].tag:''];
  }));
}
// Equipment-specific diagrams are explicit comparisons, never inferred sample metadata.
const DGA_VIEWS=[
  {key:'t1',id:'t1',context:'mineral'},
  {key:'t4',id:'t4',context:'mineral'},
  {key:'t5',id:'t5',context:'mineral'},
  {key:'p1',id:'p1',context:'mineral'},
  {key:'p2',id:'p2',context:'mineral'},
  {key:'t2',id:'t2',context:'ltc',reference:true},
  ...Object.keys(DUVAL_FLUIDS).map(context=>({key:'t3-'+context,id:'t3',context,reference:true}))
];
function dgaModel(){
  const mapping=dgaMapping(),signature=JSON.stringify(mapping);
  if(!dgaSeriesCache||dgaSeriesCache.sensors!==data.sensors||dgaSeriesCache.signature!==signature){
    const tagSet=new Set(Object.values(mapping).filter(Boolean)),rows=data.sensors.filter(r=>tagSet.has(r.tag));
    const times=[...new Set(rows.map(r=>Date.parse(r.timestamp)).filter(Number.isFinite))].sort((a,b)=>a-b);
    dgaSeriesCache={sensors:data.sensors,signature,rows,times,views:DGA_VIEWS.map(v=>({...v,method:duvalMethod(v.id,v.context),series:dgaSeries(rows,mapping,v.id,v.context)}))};
  }
  const {rows,times}=dgaSeriesCache,start=times[0],end=times.at(-1);
  if(times.length)dgaTime=dgaTime===null?end:Math.max(start,Math.min(end,dgaTime));
  const latest=new Map();for(const r of rows){const t=Date.parse(r.timestamp);if(t<=dgaTime&&(!latest.has(r.tag)||Date.parse(latest.get(r.tag).timestamp)<t))latest.set(r.tag,r);}
  const views=dgaSeriesCache.views.map(v=>({...v,sample:v.series.findLast(s=>s.time<=dgaTime)}));
  return {mapping,times,start,end,latest,views,series:views[0].series,sample:views[0].sample,method:views[0].method};
}
function dgaStop(){dgaPlaying=false;clearInterval(dgaTimer);dgaTimer=null;}
function dgaReset(){dgaStop();dgaTime=null;dgaSeriesCache=null;}
function dgaTick(){
  const now=performance.now(),m=dgaModel();
  dgaTime=replayAdvance(dgaTime,now-dgaLastTick,dgaSpeed,m.end);dgaLastTick=now;
  if(dgaTime>=m.end)dgaStop();
  if(page==='dga')dgaRefresh();else dgaStop();
}
function dgaToggle(){
  if(dgaPlaying)dgaStop();else{const m=dgaModel();if(m.times.length<2)return;if(dgaTime>=m.end)dgaTime=m.start;dgaPlaying=true;dgaLastTick=performance.now();dgaTimer=setInterval(dgaTick,100);}
  dgaRefresh();
}
function dgaTimestamp(t){return Number.isFinite(t)?new Date(t).toISOString().replace('T',' ').slice(0,19)+' UTC':'No samples';}
function dgaControls(){
  const m=dgaModel();
  return `<details id="dga-demo-details" ${dgaControlsOpen?'open':''}><summary>Demo controls</summary><div class="dga-demo-body"><div class="dga-controls"><button class="btn" id="dga-play" ${m.times.length<2?'disabled':''}>▶ Play</button><button class="btn" id="dga-restart" aria-label="Restart playback" ${!m.times.length?'disabled':''}>↶ Restart</button><label>Speed <select id="dga-speed" aria-label="Playback speed">${[[1,'1× · Real time'],[10,'10×'],[60,'60× · 1 min / sec'],[600,'600× · 10 min / sec'],[3600,'3,600× · 1 hour / sec'],[86400,'86,400× · 1 day / sec']].map(([v,l])=>`<option value="${v}" ${dgaSpeed===v?'selected':''}>${l}</option>`).join('')}</select></label><span id="dga-clock" class="table-tag" aria-live="off"></span><span id="dga-play-state" class="badge unknown"></span></div><label class="dga-scrubber">Replay position<input type="range" id="dga-scrub" aria-label="Replay position" min="${m.start||0}" max="${m.end||1}" step="1" value="${dgaTime||0}" ${m.times.length<2?'disabled':''}></label></div></details>`;
}
function dgaPage(){
  const m=dgaModel();
  return heading('DGA monitoring','',`<span class="data-source">${data.demo?'Demo data':esc(data.source||'')}</span><button class="btn primary" data-action="imports">↥ &nbsp; Import workbook</button>`)+
  `

  <div id="dga-frame"></div>
  <details class="panel dga-mapping"><summary>Gas tag mapping <span class="muted">${Object.values(m.mapping).filter(Boolean).length} / ${DGA_CATALOG.length} mapped</span></summary><p class="sub">All Duval inputs require ppm and matching sample times.</p><div class="mapping">${DGA_CATALOG.map(c=>`<label>${esc(c[1])}<select data-dga-map="${c[0]}" aria-label="${esc(c[1])} tag"><option value="">Not mapped</option>${[...new Map(data.sensors.map(r=>[r.tag,r])).values()].map(r=>`<option value="${esc(r.tag)}" ${m.mapping[c[0]]===r.tag?'selected':''}>${esc(r.tag)} · ${esc(r.name||r.tag)} (${esc(r.unit||'no unit')})</option>`).join('')}</select></label>`).join('')}</div></details>`;
}
function duvalXY(p){return [60+480*(p[1]+p[0]/2)/100,460-415.692*p[0]/100]}
function dgaTriangle(m){
  const method=m.method||duvalMethod(),sample=m.sample,valid=sample?.valid,pentagon=method.pentagon;
  if(!method.zones.length)return '<div class="empty">Choose the imported sample’s alternative fluid to display Triangle 3.</div>';
  const xy=p=>pentagon?[300+5.7*p[0],260-5.7*p[1]]:duvalXY(p);
  const point=p=>xy(p).map(n=>n.toFixed(3)).join(',');
  const history=m.series.map((s,index)=>({...s,index})).filter(s=>s.time<=dgaTime&&s.valid).slice(-1000);
  const tickStyle='class="duval-tick"';
  const grid=pentagon?[10,20,30,40].map(n=>`<polygon points="${[0,1,2,3,4].map(i=>{const a=(90+i*72)*Math.PI/180;return point([n*Math.cos(a),n*Math.sin(a)]);}).join(' ')}" fill="none" stroke="#344b4930" stroke-dasharray="2 4"/>`).join(''):
    [20,40,60,80].flatMap(n=>[[[n,0,100-n],[n,100-n,0]],[[0,n,100-n],[100-n,n,0]],[[0,100-n,n],[100-n,0,n]]].map(line=>`<polyline points="${line.map(point).join(' ')}" fill="none" stroke="#344b4930" stroke-dasharray="2 4"/>`)).join('');
  const axes=pentagon?method.gases.map((g,i)=>{const a=(90+i*72)*Math.PI/180,[x,y]=xy([45*Math.cos(a),43*Math.sin(a)]);return `<text x="${x}" y="${y}" text-anchor="middle" class="duval-axis">${DUVAL_GASES[g][0]}</text>`;}).join('')+`<text x="300" y="500" text-anchor="middle" ${tickStyle}>Area centroid · Cartesian coordinates</text>`:
    `<text x="300" y="20" text-anchor="middle" class="duval-axis">${DUVAL_GASES[method.gases[0]][0]} · 100%</text><text x="60" y="501" text-anchor="middle" class="duval-axis">${DUVAL_GASES[method.gases[2]][0]} · 100%</text><text x="540" y="501" text-anchor="middle" class="duval-axis">${DUVAL_GASES[method.gases[1]][0]} · 100%</text>`+
    [20,40,60,80].map(n=>{const [x,y]=xy([n,0,100-n]),[rx,ry]=xy([100-n,n,0]);return `<text x="${x-12}" y="${y+3}" text-anchor="end" ${tickStyle}>${n}</text><text x="${rx+12}" y="${ry+3}" ${tickStyle}>${n}</text><text x="${xy([0,100-n,n])[0]}" y="478" text-anchor="middle" ${tickStyle}>${n}</text>`;}).join('');
  return `<svg class="duval-svg" viewBox="0 0 600 510" role="img" aria-label="${esc(method.name)}. ${valid?'Selected sample in '+sample.zones.join(' / '):'No applicable sample at this time'}"><title>${esc(method.name)} · ${method.gases.join(', ')}. Latest plotted region: ${valid?sample.zones.join(' / '):'unavailable'}.</title>
  ${method.zones.flatMap(z=>(z.polygons||[z.vertices]).map(vertices=>`<polygon points="${vertices.map(point).join(' ')}" fill="${z.color}" stroke="${z.color}" stroke-width=".5"><title>${z.id}: ${esc(z.name)}</title></polygon>`)).join('')}
  ${grid}${axes}
  ${method.zones.flatMap(z=>[z.label,...(z.extraLabels||[])].map(label=>{const [x,y]=xy(label);if(z.id==='PD')return `<path d="M${x} ${y}l-42 -3" stroke="#536c70"/><text x="${x-48}" y="${y}" text-anchor="end" class="duval-label">PD</text>`;return `<text x="${x}" y="${y}" text-anchor="middle" class="duval-label">${z.id}</text>`;})).join('')}
  ${history.map((s,i)=>{const [x,y]=xy(s.point||s.percentages),previous=history[i-1],adjacent=previous&&s.index===previous.index+1;return `${adjacent?`<path d="M${point(previous.point||previous.percentages)}L${point(s.point||s.percentages)}" fill="none" stroke="#25493e" stroke-width="1.7" opacity=".5"/>`:''}<circle cx="${x}" cy="${y}" r="2.8" fill="#25493e" opacity=".45"><title>${dgaTimestamp(s.time)}: ${s.zones.join(' / ')}</title></circle>`;}).join('')}
  ${valid?`<circle cx="${xy(sample.point||sample.percentages)[0]}" cy="${xy(sample.point||sample.percentages)[1]}" r="9" fill="white" stroke="#183f35" stroke-width="2"/><circle cx="${xy(sample.point||sample.percentages)[0]}" cy="${xy(sample.point||sample.percentages)[1]}" r="4" fill="#183f35"/>`:''}</svg>`;
}
function dgaCard(view,m){
  const {method,sample:s}=view,valid=s?.valid;
  const required=[...new Set([...method.gases,...(method.prerequisite?DUVAL_METHODS.t1.gases:[])])],missing=required.filter(g=>!m.mapping['DGA-'+g]);
  const reason=missing.length?'Map '+missing.join(', ')+' below.':s&&!valid?s.reason:!s?'No simultaneous sample is available.':'';
  const region=valid?s.zones.join(' / '):s?.primaryZones?'Not applicable':'Unavailable';
  const description=valid?s.zones.map(id=>method.zones.find(z=>z.id===id)?.name||id).join(' / '):reason;
  return `<section class="panel dga-card ${view.reference?'dga-reference':''}" data-duval-card="${view.key}">
    <div class="dga-card-head"><h2>${esc(method.name)}</h2><p>${view.reference?'Comparison reference':esc(method.scope)}</p></div>
    ${dgaTriangle(view)}
    <div class="dga-card-result"><div class="dga-region-line"><strong class="dga-region">${region}</strong>${valid&&s.boundary?'<span class="badge unknown">Boundary</span>':''}${valid&&s.primaryZones?`<span class="dga-prerequisite">Triangle 1 · ${s.primaryZones.join(' / ')}</span>`:''}</div><p>${esc(description)}</p>
    ${view.id==='t2'?'<p class="dga-reference-note">Use only for a conventional oil-arcing LTC compartment.</p>':view.id==='t3'?`<p class="dga-reference-note">Use only for ${esc(DUVAL_FLUIDS[view.context].name)} main-tank samples.</p>`:''}
    <div class="dga-percentages">${method.gases.map((g,i)=>`<span>${DUVAL_GASES[g][0]} <b>${valid?fmt(s.percentages[i])+'%':'—'}</b></span>`).join('')}</div>
    <div class="dga-sample-time">Sample · ${s?dgaTimestamp(s.time):'—'}</div></div></section>`;
}
function dgaFrame(m){
  const mapped=Object.values(m.mapping).filter(Boolean).length;
  return `<div class="dga-dashboard-bar"><div><h2>Duval dashboard</h2><p>Shared gas readings · mineral-oil main-tank methods and labeled comparisons</p></div><div class="dga-dashboard-clock"><span>${dgaTimestamp(dgaTime)}</span><small>● History &nbsp; ◉ Selected sample</small></div></div>
  <div class="dga-gas-strip">${['H2','CH4','C2H4','C2H2','C2H6'].map(g=>{const r=m.latest.get(m.mapping['DGA-'+g]);return `<div><span>${DUVAL_GASES[g][0]} <small>${DUVAL_GASES[g][1]}</small></span><strong>${r?fmt(r.actual):'—'} <small>${esc(r?.unit||'ppm')}</small></strong><time>${r?dgaTimestamp(Date.parse(r.timestamp)):'No reading'}</time></div>`;}).join('')}</div>
  <div class="dga-dashboard-grid">${m.views.filter(v=>v.id!=='t3').map(v=>dgaCard(v,m)).join('')}</div>
  <div class="dga-section-heading"><h2>Duval Triangle 3 <span>Alternative-fluid comparisons</span></h2><p>The same concentrations shown against each fluid’s boundaries. Use the result for the actual insulating fluid.</p></div>
  <div class="dga-fluid-grid">${m.views.filter(v=>v.id==='t3').map(v=>dgaCard(v,m)).join('')}</div>
  <section class="panel dga-trend-panel"><div class="panel-head"><div><h2>Gas trend</h2><p class="sub">24 hours</p></div><select id="dga-trend" aria-label="Gas trend channel">${DGA_CATALOG.map(c=>`<option value="${c[0]}" ${dgaTrend===c[0]?'selected':''}>${esc(c[1])}</option>`).join('')}</select></div>${dgaTrendChart(m)}</section>
  <section class="panel"><div class="panel-head"><div><h2>All DGA monitors <span class="muted">${mapped} / ${DGA_CATALOG.length} mapped</span></h2></div></div><div class="table-wrap"><table class="dga-table"><thead><tr><th>Measurement / tag</th><th>Actual</th><th>Estimate</th><th>Sample time (UTC)</th><th>Advisory</th><th>Diagnostic advisory</th></tr></thead><tbody>${DGA_CATALOG.map((c,i)=>{const r=m.latest.get(m.mapping[c[0]]);return `${i===0||DGA_CATALOG[i-1][6]!==c[6]?`<tr class="dga-group"><th colspan="6">${esc(c[6])}</th></tr>`:''}<tr><td>${esc(c[1])}<small>${esc(m.mapping[c[0]]||'Not mapped')}</small></td><td class="numeric">${r?fmt(r.actual):'—'} <small>${esc(r?.unit||c[5])}</small></td><td class="numeric">${r?fmt(r.predicted):'—'}</td><td>${r?dateLabel(r.timestamp):'No sample yet'}</td><td>${r?indicatorBadge(r):'—'}</td><td>${r?indicatorBadge(r,true):'—'}</td></tr>`}).join('')}</tbody></table></div></section>
  <details class="note-panel dga-method"><summary>Method &amp; sources</summary><p>Every chart follows the same replay clock and uses simultaneous concentrations in ppm. Each triangle normalizes its three gases; pentagons use the five-gas area centroid. Missing, negative, duplicate and zero-total samples are excluded. Shared boundaries show adjacent regions. Pentagon zero readings require laboratory-approved detection-limit values.</p><p>Triangles 1, 4, 5 and both pentagons are mineral-oil main-tank methods. Triangles 4 and 5 retain their simultaneous Triangle 1 applicability checks. Triangle 2 is a comparison for conventional oil-arcing LTC compartments; ethylene and acetylene both below 10 ppm prevent classification. Triangle 3 shows all four fluid-specific comparisons; silicone, MIDEL and BIOTEMP T2/T3 limits are extrapolated. No compartment or fluid is inferred from gas concentrations.</p><p>Regions suggest fault type, not severity or proof of a fault. ND means not determined. C indicates possible paper carbonization; investigate carbon oxides and furans. Temperature ranges are categories, not measured temperatures.</p><div class="dga-legend">${[...new Map(m.views.flatMap(v=>v.method.zones).map(z=>[z.id+'|'+z.name,z])).values()].map(z=>`<span><i style="background:${z.color}"></i><b>${esc(z.id)}</b> ${esc(z.name)}</span>`).join('')}</div><p>Reference edition: <a href="${DUVAL_REFERENCE}" target="_blank" rel="noopener">IEEE reference workbooks (2016)</a>; <a href="https://doi.org/10.1109/MEI.2008.4665347" target="_blank" rel="noopener">Duval’s triangle paper</a>. The <a href="https://grouper.ieee.org/groups/transformers/subcommittees/fluids/C57.104/S25-C57.104-MtgPresentation.pdf" target="_blank" rel="noopener">2025 IEEE correction examples</a> were checked against the workbooks. <a href="duval-methods.html" target="_blank" rel="noopener">Implementation &amp; validation notes</a>.</p></details>`;
}

function dgaTrendChart(m){
  if(!m.mapping[dgaTrend]||!m.latest.has(m.mapping[dgaTrend]))return '<div class="empty">No readings at this time.</div>';
  const oldStamp=stamp,oldTag=selectedTag;stamp=new Date(dgaTime).toISOString();selectedTag=m.mapping[dgaTrend];
  try{return chart()}finally{stamp=oldStamp;selectedTag=oldTag;}
}
function dgaRefresh(){
  const frame=$('#dga-frame');if(!frame)return;
  const m=dgaModel();frame.innerHTML=dgaFrame(m);
  $('#dga-clock').textContent=dgaTimestamp(dgaTime);
  $('#dga-play').textContent=dgaPlaying?'Ⅱ Pause':'▶ Play';
  $('#dga-play-state').textContent=dgaPlaying?'Playing':dgaTime===m.end?'End of recording':'Paused';
  $('#dga-scrub').value=dgaTime||0;
  $('#dga-trend').onpointerdown=()=>{if(dgaPlaying){dgaStop();$('#dga-play').textContent='▶ Play';$('#dga-play-state').textContent='Paused';}};
  $('#dga-trend').onfocus=()=>{if(dgaPlaying){dgaStop();$('#dga-play').textContent='▶ Play';$('#dga-play-state').textContent='Paused';}};
  $('#dga-trend').onchange=e=>{dgaTrend=e.target.value;dgaRefresh();};
}
function bindDga(){
  const controls=$('#dga-demo');
  controls.hidden=page!=='dga';
  if(page!=='dga'){controls.innerHTML='';return;}
  controls.innerHTML=dgaControls();
  $('#dga-demo-details').ontoggle=e=>{dgaControlsOpen=e.target.open;};
  dgaRefresh();$('#dga-play').onclick=dgaToggle;
  $('#dga-restart').onclick=()=>{dgaStop();dgaTime=dgaModel().start;dgaRefresh();};
  $('#dga-speed').onchange=e=>{if(dgaPlaying)dgaTick();dgaSpeed=Number(e.target.value);dgaLastTick=performance.now();};
  $('#dga-scrub').oninput=e=>{dgaStop();dgaTime=Number(e.target.value);dgaRefresh();};
  document.querySelectorAll('[data-dga-map]').forEach(select=>select.onchange=e=>{
    dgaStop();const mapping=dgaMapping(),key=select.dataset.dgaMap,value=e.target.value;
    if(value&&Object.entries(mapping).some(([k,v])=>k!==key&&v===value)){notify('That tag is already assigned to another gas channel. Unassign it first.');render();return;}
    const next=structuredClone(data);next.dgaMappings={...mapping,[key]:value};if(save(next)){dgaTime=null;render();}
  });
}
