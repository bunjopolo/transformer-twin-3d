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
// This asset monitors one mineral-oil main transformer tank.
const DGA_VIEWS=[
  {key:'t1',id:'t1',context:'mineral'},
  {key:'t4',id:'t4',context:'mineral'},
  {key:'t5',id:'t5',context:'mineral'},
  {key:'p1',id:'p1',context:'mineral'}
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
  <details class="panel dga-mapping"><summary>Gas tag mapping <span class="muted">${Object.values(m.mapping).filter(Boolean).length} / ${DGA_CATALOG.length} mapped</span></summary><p class="sub">Requires ppm and matching timestamps.</p><div class="mapping">${DGA_CATALOG.map(c=>`<label>${esc(c[1])}<select data-dga-map="${c[0]}" aria-label="${esc(c[1])} tag"><option value="">Not mapped</option>${[...new Map(data.sensors.map(r=>[r.tag,r])).values()].map(r=>`<option value="${esc(r.tag)}" ${m.mapping[c[0]]===r.tag?'selected':''}>${esc(r.tag)} · ${esc(r.name||r.tag)} (${esc(r.unit||'no unit')})</option>`).join('')}</select></label>`).join('')}</div></details>`;
}
function duvalXY(p){return [60+480*(p[1]+p[0]/2)/100,460-415.692*p[0]/100]}
function duvalTimeColor(time,start,end){const fraction=end>start?Math.max(0,Math.min(1,(time-start)/(end-start))):1;return `hsl(${Math.round(220-190*fraction)} 75% 40%)`;}
function duvalMovementHistory(series,until=dgaTime){return series.map((sample,index)=>({...sample,index})).filter(s=>s.time<=until).slice(-1000);}
function duvalTransitions(series){let previous=null;return series.flatMap(s=>{const label=s.valid?s.zones.join(' / '):s.primaryZones?'Not applicable':'Unavailable',signature=label+'|'+(s.valid?'':s.reason||'');if(signature===previous)return [];previous=signature;return [{...s,label}];});}
function duvalMovementLegend(view){const history=duvalMovementHistory(view.series).filter(s=>s.valid);return `<div class="duval-time-legend"><span>Earlier</span><i></i><span>Later</span></div><div class="duval-time-caption">${history.length?`${dgaTimestamp(history[0].time)} → ${dgaTimestamp(history.at(-1).time)}<br>${history.length} valid points · latest 1,000 samples up to replay time`:'No valid trajectory at this time.'}</div>`;}
function duvalMovementTimeline(m){return `<section class="panel duval-movement"><div class="panel-head"><div><h2>Duval movement over time</h2><p class="sub">Classification changes across the recording · Select a timestamp to pause and inspect that sample.</p></div></div><p class="duval-movement-note">Colours on the diagrams represent time, not severity. Lines connect consecutive valid samples only; invalid samples break the trail. Boundary samples list every adjacent region.</p><div class="duval-timeline-grid">${m.views.map(v=>{const transitions=duvalTransitions(v.series);return `<div class="duval-timeline-method"><h3>${esc(v.method.name)}</h3><div class="duval-timeline-scroll" aria-label="${esc(v.method.name)} classification history">${transitions.map((s,i)=>{const active=dgaTime>=s.time&&(!transitions[i+1]||dgaTime<transitions[i+1].time);return `<button type="button" data-duval-time="${s.time}" class="duval-event ${active?'active':''}" aria-pressed="${active}"><time>${dgaTimestamp(s.time)}</time><strong>${esc(s.label)}${s.boundary?' · Boundary':''}</strong>${!s.valid?`<small>${esc(s.reason||'No valid sample')}</small>`:''}</button>`;}).join('')||'<p class="empty">No samples.</p>'}</div></div>`;}).join('')}</div></section>`;}
function duvalDirectionArrow(history,sample,xy){
  if(!sample?.valid||history.length<2)return '';
  const current=history.at(-1);if(!current.valid||current.time!==sample.time)return '';
  const [x,y]=xy(current.point||current.percentages);
  for(let i=history.length-2;i>=0;i--){
    const previous=history[i];if(!previous.valid)return '';
    const [px,py]=xy(previous.point||previous.percentages),dx=x-px,dy=y-py,length=Math.hypot(dx,dy);
    if(length<.01)return '';
    const ux=dx/length,uy=dy/length,tipX=x+18*ux,tipY=y+18*uy,baseX=x+10*ux,baseY=y+10*uy;
    return `<g class="duval-direction" role="img" aria-label="Recent movement direction"><title>Recent movement direction: ${dgaTimestamp(previous.time)} to ${dgaTimestamp(current.time)}. Direction only, not a forecast.</title><polygon points="${tipX},${tipY} ${baseX-4*uy},${baseY+4*ux} ${baseX+4*uy},${baseY-4*ux}" fill="#183f35" stroke="white" stroke-width=".8"/></g>`;
  }
  return '';
}
function dgaTriangle(m){
  const method=m.method||duvalMethod(),sample=m.sample,valid=sample?.valid,pentagon=method.pentagon;
  if(!method.zones.length)return '<div class="empty">No diagram geometry is available.</div>';
  const xy=p=>pentagon?[300+5.7*p[0],260-5.7*p[1]]:duvalXY(p);
  const point=p=>xy(p).map(n=>n.toFixed(3)).join(',');
  const windowHistory=duvalMovementHistory(m.series),history=windowHistory.filter(s=>s.valid),start=history[0]?.time,end=history.at(-1)?.time;
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
  ${history.map((s,i)=>{const [x,y]=xy(s.point||s.percentages),previous=history[i-1],adjacent=previous&&s.index===previous.index+1;return `${adjacent?`<path d="M${point(previous.point||previous.percentages)}L${point(s.point||s.percentages)}" fill="none" stroke="${duvalTimeColor(s.time,start,end)}" stroke-width="2.2" opacity=".85"/>`:''}<circle cx="${x}" cy="${y}" r="3.3" fill="${duvalTimeColor(s.time,start,end)}" opacity=".9"><title>${dgaTimestamp(s.time)}: ${s.zones.join(' / ')}${s.boundary?' · Boundary':''} · ${esc((s.rows||[]).map((r,j)=>method.gases[j]+': '+r.actual+' ppm').join(', '))}</title></circle>`;}).join('')}
  ${valid?`<circle cx="${xy(sample.point||sample.percentages)[0]}" cy="${xy(sample.point||sample.percentages)[1]}" r="9" fill="white" stroke="#183f35" stroke-width="2"/><circle cx="${xy(sample.point||sample.percentages)[0]}" cy="${xy(sample.point||sample.percentages)[1]}" r="4" fill="#183f35"/>`:''}${duvalDirectionArrow(windowHistory,sample,xy)}</svg>`;
}
function dgaCard(view,m){
  const {method,sample:s}=view,valid=s?.valid;
  const required=[...new Set([...method.gases,...(method.prerequisite?DUVAL_METHODS.t1.gases:[])])],missing=required.filter(g=>!m.mapping['DGA-'+g]);
  const reason=missing.length?'Map '+missing.join(', ')+' below.':s&&!valid?s.reason:!s?'No simultaneous sample.':'';
  const region=valid?s.zones.join(' / '):s?.primaryZones?'Not applicable':'Unavailable';
  const description=valid?s.zones.map(id=>method.zones.find(z=>z.id===id)?.name||id).join(' / '):reason;
  return `<section class="panel dga-card" data-duval-card="${view.key}">
    <div class="dga-card-head"><h2>${esc(method.name)}</h2></div>
    ${dgaTriangle(view)}${duvalMovementLegend(view)}
    <div class="dga-card-result"><div class="dga-region-line"><strong class="dga-region">${region}</strong>${valid&&s.boundary?'<span class="badge unknown">Boundary</span>':''}${valid&&s.primaryZones?`<span class="dga-prerequisite">Triangle 1 · ${s.primaryZones.join(' / ')}</span>`:''}</div><p>${esc(description)}</p>
    <div class="dga-percentages">${method.gases.map((g,i)=>`<span>${DUVAL_GASES[g][0]} <b>${valid?fmt(s.percentages[i])+'%':'—'}</b></span>`).join('')}</div>
    <div class="duval-absolute">${(s?.rows||[]).map((r,i)=>`<span>${esc(method.gases[i])}: <b>${r?fmt(r.actual):'—'}</b> ppm</span>`).join('')}</div><div class="dga-sample-time">Sample · ${s?dgaTimestamp(s.time):'—'}</div></div></section>`;
}
function dgaFrame(m){
  const mapped=Object.values(m.mapping).filter(Boolean).length;
  return `<div class="dga-dashboard-bar"><div><h2>Duval analysis</h2><p>Main tank · Mineral oil</p></div><div class="dga-dashboard-clock"><span>${dgaTimestamp(dgaTime)}</span><small>● History &nbsp; ◉ Selected sample &nbsp; ↗ Recent direction</small></div></div>
  <div class="dga-gas-strip">${['H2','CH4','C2H4','C2H2','C2H6'].map(g=>{const r=m.latest.get(m.mapping['DGA-'+g]);return `<div><span>${DUVAL_GASES[g][0]} <small>${DUVAL_GASES[g][1]}</small></span><strong>${r?fmt(r.actual):'—'} <small>${esc(r?.unit||'ppm')}</small></strong><time>${r?dgaTimestamp(Date.parse(r.timestamp)):'No reading'}</time></div>`;}).join('')}</div>
  <div class="dga-dashboard-grid">${m.views.map(v=>dgaCard(v,m)).join('')}</div>
  ${duvalMovementTimeline(m)}
  ${trendStack(DGA_CATALOG.map(c=>({tag:m.mapping[c[0]]||c[0],name:c[1]})),new Date(dgaTime).toISOString())}
  <section class="panel"><div class="panel-head"><div><h2>DGA readings <span class="muted">${mapped} / ${DGA_CATALOG.length} mapped</span></h2></div></div><div class="table-wrap"><table class="dga-table"><thead><tr><th>Measurement / tag</th><th>Actual</th><th>Estimate</th><th>Sample time (UTC)</th><th>Local limits</th><th>Advisories</th></tr></thead><tbody>${DGA_CATALOG.map((c,i)=>{const r=m.latest.get(m.mapping[c[0]]);return `${i===0||DGA_CATALOG[i-1][6]!==c[6]?`<tr class="dga-group"><th colspan="6">${esc(c[6])}</th></tr>`:''}<tr><td>${esc(c[1])}<small>${esc(m.mapping[c[0]]||'Not mapped')}</small></td><td class="numeric">${r?fmt(r.actual):'—'} <small>${esc(r?.unit||c[5])}</small></td><td class="numeric">${r?fmt(r.predicted):'—'}</td><td>${r?dateLabel(r.timestamp):'No sample yet'}</td><td>${limitBadge(r)}</td><td>${r?combinedAdvisories(r):'—'}</td></tr>`}).join('')}</tbody></table></div></section>
  <details class="note-panel dga-method"><summary>Method &amp; sources</summary><p>Every chart follows the same replay clock and uses simultaneous concentrations in ppm. Each triangle normalizes its three gases; Pentagon 1 uses the five-gas area centroid. Missing, negative, duplicate and zero-total samples are excluded. Shared boundaries show adjacent regions. Pentagon zero readings require laboratory-approved detection-limit values.</p><p>Triangles 1, 4, 5 and Pentagon 1 are mineral-oil main-tank methods. Triangles 4 and 5 retain their simultaneous Triangle 1 applicability checks.</p><p>Regions suggest fault type, not severity or proof of a fault. ND means not determined. C indicates possible paper carbonization; investigate carbon oxides and furans. Temperature ranges are categories, not measured temperatures.</p><div class="dga-legend">${[...new Map(m.views.flatMap(v=>v.method.zones).map(z=>[z.id+'|'+z.name,z])).values()].map(z=>`<span><i style="background:${z.color}"></i><b>${esc(z.id)}</b> ${esc(z.name)}</span>`).join('')}</div><p>Reference edition: <a href="${DUVAL_REFERENCE}" target="_blank" rel="noopener">IEEE reference workbooks (2016)</a>; <a href="https://doi.org/10.1109/MEI.2008.4665347" target="_blank" rel="noopener">Duval’s triangle paper</a>. The <a href="https://grouper.ieee.org/groups/transformers/subcommittees/fluids/C57.104/S25-C57.104-MtgPresentation.pdf" target="_blank" rel="noopener">2025 IEEE correction examples</a> were checked against the workbooks. <a href="duval-methods.html" target="_blank" rel="noopener">Implementation &amp; validation notes</a>.</p></details>`;
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
  frame.querySelectorAll('[data-duval-time]').forEach(button=>button.onclick=()=>{const time=Number(button.dataset.duvalTime);if(!Number.isFinite(time))return;dgaStop();dgaTime=time;dgaRefresh();});

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
