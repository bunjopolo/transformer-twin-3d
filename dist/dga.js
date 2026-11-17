'use strict';
const DGA_CATALOG=TAG_CATALOG.filter(r=>r[6].startsWith('DGA'));
let dgaTime=null,dgaPlaying=false,dgaSpeed=3600,dgaTimer=null,dgaLastTick=0,dgaTrend='DGA-CH4';
function dgaMapping(){
  const tags=new Map();for(const r of data.sensors)tags.set(r.tag,r);
  return Object.fromEntries(DGA_CATALOG.map(c=>{
    if(Object.hasOwn(data.dgaMappings||{},c[0]))return [c[0],tags.has(data.dgaMappings[c[0]])?data.dgaMappings[c[0]]:''];
    const matches=[...tags.values()].filter(r=>(catalogTag(r.tag)||catalogTag(r.name))?.[0]===c[0]);
    return [c[0],matches.length===1?matches[0].tag:''];
  }));
}
function dgaModel(){
  const mapping=dgaMapping(),tagSet=new Set(Object.values(mapping).filter(Boolean));
  const rows=data.sensors.filter(r=>tagSet.has(r.tag));
  const times=[...new Set(rows.map(r=>Date.parse(r.timestamp)).filter(Number.isFinite))].sort((a,b)=>a-b);
  const start=times[0],end=times.at(-1);
  if(times.length)dgaTime=dgaTime===null?end:Math.max(start,Math.min(end,dgaTime));
  const latest=new Map();for(const r of rows){const t=Date.parse(r.timestamp);if(t<=dgaTime&&(!latest.has(r.tag)||Date.parse(latest.get(r.tag).timestamp)<t))latest.set(r.tag,r);}
  const series=dgaSeries(rows,mapping),sample=series.filter(s=>s.time<=dgaTime).at(-1);
  return {mapping,times,start,end,latest,series,sample};
}
function dgaStop(){dgaPlaying=false;clearInterval(dgaTimer);dgaTimer=null;}
function dgaReset(){dgaStop();dgaTime=null;}
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
function dgaPage(){
  const m=dgaModel();
  return heading('DGA monitoring','Transformer 4 · Phase A · Dissolved gas analysis',`<button class="btn primary" data-action="imports">↥ &nbsp; Import workbook</button>`)+
  `<div class="source-strip"><strong>${data.demo?'DEMONSTRATION DATA':'WORKBOOK REPLAY'} · ${esc(data.source||'Imported readings')}</strong><span>Playback of recorded measurements · No live connection</span></div>
  <section class="panel dga-playback"><div class="dga-controls"><button class="btn primary" id="dga-play" ${m.times.length<2?'disabled':''}>▶ Play</button><button class="btn" id="dga-restart" aria-label="Restart playback" ${!m.times.length?'disabled':''}>↶ Restart</button><label>Speed <select id="dga-speed" aria-label="Playback speed">${[[1,'1× · Real time'],[10,'10×'],[60,'60× · 1 min / sec'],[600,'600× · 10 min / sec'],[3600,'3,600× · 1 hour / sec'],[86400,'86,400× · 1 day / sec']].map(([v,l])=>`<option value="${v}" ${dgaSpeed===v?'selected':''}>${l}</option>`).join('')}</select></label><span id="dga-clock" class="table-tag" aria-live="off"></span><span id="dga-play-state" class="badge unknown"></span></div><label class="dga-scrubber">Replay position<input type="range" id="dga-scrub" aria-label="Replay position" min="${m.start||0}" max="${m.end||1}" step="1" value="${dgaTime||0}" ${m.times.length<2?'disabled':''}></label><div class="dga-time-ends"><span>${dgaTimestamp(m.start)}</span><span>${dgaTimestamp(m.end)}</span></div><p class="sub">Values advance when the next recorded sample arrives. No interpolation between measurements.</p></section>
  <div id="dga-frame"></div>
  <details class="panel dga-mapping"><summary>Gas tag mapping <span class="muted">${Object.values(m.mapping).filter(Boolean).length} / ${DGA_CATALOG.length} channels assigned</span></summary><p class="sub">Assign workbook tags to the gas channels. Use concentration tags in ppm for the triangle; rate-of-change tags are separate.</p><div class="mapping">${DGA_CATALOG.map(c=>`<label>${esc(c[1])}<select data-dga-map="${c[0]}" aria-label="${esc(c[1])} tag"><option value="">Not mapped</option>${[...new Map(data.sensors.map(r=>[r.tag,r])).values()].map(r=>`<option value="${esc(r.tag)}" ${m.mapping[c[0]]===r.tag?'selected':''}>${esc(r.tag)} · ${esc(r.name||r.tag)} (${esc(r.unit||'no unit')})</option>`).join('')}</select></label>`).join('')}</div></details>`;
}
function duvalXY(p){return [60+480*(p[1]+p[0]/2)/100,460-415.692*p[0]/100]}
function dgaTriangle(m){
  const sample=m.sample,valid=sample?.valid;
  const history=m.series.filter(s=>s.time<=dgaTime&&s.valid).slice(-1000);
  const point=p=>duvalXY(p).map(n=>n.toFixed(3)).join(',');
  return `<svg class="duval-svg" viewBox="0 0 600 510" role="img" aria-label="Duval Triangle 1. ${valid?'Selected sample in '+sample.zones.join(' / '):'No valid sample at this time'}"><title>CH4 at the top, C2H4 at bottom right, C2H2 at bottom left. Latest plotted region: ${valid?sample.zones.join(' / '):'unavailable'}.</title>
  ${DUVAL_ZONES.map(z=>`<polygon points="${z.vertices.map(point).join(' ')}" fill="${z.color}" stroke="#fff" stroke-width="1.2"><title>${z.id}: ${z.name}</title></polygon>`).join('')}
  ${[20,40,60,80].flatMap(n=>[[[n,0,100-n],[n,100-n,0]],[[0,n,100-n],[100-n,n,0]],[[0,100-n,n],[100-n,0,n]]].map(line=>`<polyline points="${line.map(point).join(' ')}" fill="none" stroke="#344b4930" stroke-dasharray="2 4"/>`)).join('')}
  ${[20,40,60,80].map(n=>{const [x,y]=duvalXY([n,0,100-n]);return `<text x="${x-12}" y="${y+3}" text-anchor="end" class="duval-tick">${n}</text>`}).join('')}
  ${[20,40,60,80].map(n=>{const [x,y]=duvalXY([100-n,n,0]);return `<text x="${x+12}" y="${y+3}" class="duval-tick">${n}</text>`}).join('')}
  ${[20,40,60,80].map(n=>`<text x="${duvalXY([0,100-n,n])[0]}" y="478" text-anchor="middle" class="duval-tick">${n}</text>`).join('')}
  <text x="300" y="20" text-anchor="middle" class="duval-axis">CH₄ · 100%</text><text x="60" y="501" text-anchor="middle" class="duval-axis">C₂H₂ · 100%</text><text x="540" y="501" text-anchor="middle" class="duval-axis">C₂H₄ · 100%</text>
  ${DUVAL_ZONES.map(z=>{const [x,y]=duvalXY(z.label);return z.id==='PD'?`<path d="M300 48L252 46" stroke="#536c70"/><text x="240" y="49" class="duval-label">PD</text>`:`<text x="${x}" y="${y}" text-anchor="middle" class="duval-label">${z.id}</text>`}).join('')}
  ${history.map((s,i)=>{const [x,y]=duvalXY(s.percentages);const previous=history[i-1];const adjacent=previous&&m.series.indexOf(s)===m.series.indexOf(previous)+1;return `${adjacent?`<path d="M${point(previous.percentages)}L${point(s.percentages)}" fill="none" stroke="#25493e" stroke-width="1.7" opacity=".5"/>`:''}<circle cx="${x}" cy="${y}" r="2.8" fill="#25493e" opacity=".45"><title>${dgaTimestamp(s.time)}: ${s.zones.join(' / ')}</title></circle>`}).join('')}
  ${valid?`<circle cx="${duvalXY(sample.percentages)[0]}" cy="${duvalXY(sample.percentages)[1]}" r="9" fill="white" stroke="#183f35" stroke-width="2"/><circle cx="${duvalXY(sample.percentages)[0]}" cy="${duvalXY(sample.percentages)[1]}" r="4" fill="#183f35"/>`:''}</svg>`;
}
function dgaFrame(m){
  const s=m.sample,valid=s?.valid,zoneText=valid?s.zones.join(' / '):'Unavailable';
  const mapped=Object.values(m.mapping).filter(Boolean).length;
  const triangleMissing=['DGA-CH4','DGA-C2H4','DGA-C2H2'].some(k=>!m.mapping[k]);
  return `<div class="dga-grid"><section class="panel"><div class="panel-head"><div><h2>Duval Triangle 1</h2><p class="sub">Actual concentrations · Mineral-oil method</p></div><span class="badge unknown">${valid?'● Selected sample':'No current point'}</span></div>${dgaTriangle(m)}<div class="diagram-footer"><span>● Historical samples &nbsp; ◉ Selected sample</span><span>Up to 1,000 valid points</span></div></section>
  <div class="stack"><section class="panel"><div class="panel-head"><h2>Selected sample</h2><span class="badge unknown">${data.demo?'Illustrative':'Calculated region'}</span></div><div class="dga-result"><div class="dga-zone">${zoneText}</div><h3>${valid?(s.boundary?'On a zone boundary':esc(DUVAL_ZONES.find(z=>z.id===s.zones[0]).name)):'Waiting for a valid gas triplet'}</h3><p class="sub">${valid&&s.boundary?s.zones.map(id=>esc(DUVAL_ZONES.find(z=>z.id===id).name)).join(' / '):triangleMissing?'Map methane, ethylene and acetylene below.':s&&!valid?esc(s.reason):''}</p><p class="table-tag">Sample: ${s?dgaTimestamp(s.time):'—'}</p>${s?`<p class="muted">${dgaTime>s.time?'Held from previous sample · '+fmt((dgaTime-s.time)/1000)+' seconds before replay clock':'At replay clock'}</p>`:''}
  <div class="dga-inputs">${[['CH₄','Methane'],['C₂H₄','Ethylene'],['C₂H₂','Acetylene']].map(([formula,name],i)=>`<div><span>${formula}<small>${name}</small></span><strong>${s?.rows[i]?fmt(s.rows[i].actual):'—'} <small>${esc(s?.rows[i]?.unit||'ppm')}</small></strong><span>${valid?fmt(s.percentages[i])+'%':'—'}</span></div>`).join('')}</div><p class="sub">Percent = gas ÷ (CH₄ + C₂H₄ + C₂H₂) × 100.</p></div></section>
  <div class="note-panel"><strong>Interpret the region with the gas levels</strong>A triangle region suggests a fault type; it does not establish that a fault is present or its severity. Assess concentrations, rates of change and equipment history together. Temperature labels describe fault categories, not a measured winding temperature.</div></div></div>
  <div class="dga-legend">${DUVAL_ZONES.map(z=>`<span><i style="background:${z.color}"></i><b>${z.id}</b> ${z.name}</span>`).join('')}</div>
  <section class="panel dga-trend-panel"><div class="panel-head"><div><h2>Gas trend</h2><p class="sub">Actual vs. imported estimate · 24 hours to replay clock</p></div><select id="dga-trend" aria-label="Gas trend channel">${DGA_CATALOG.map(c=>`<option value="${c[0]}" ${dgaTrend===c[0]?'selected':''}>${esc(c[1])}</option>`).join('')}</select></div>${dgaTrendChart(m)}</section>
  <section class="panel"><div class="panel-head"><div><h2>All DGA monitors <span class="muted">${mapped} / ${DGA_CATALOG.length} mapped</span></h2><p class="sub">Latest measurement at or before replay clock · Source messages preserved</p></div></div><div class="table-wrap"><table class="dga-table"><thead><tr><th>Measurement / tag</th><th>Actual</th><th>Estimate</th><th>Sample time (UTC)</th><th>Advisory</th><th>Diagnostic advisory</th></tr></thead><tbody>${DGA_CATALOG.map((c,i)=>{const r=m.latest.get(m.mapping[c[0]]);return `${i===0||DGA_CATALOG[i-1][6]!==c[6]?`<tr class="dga-group"><th colspan="6">${esc(c[6])}</th></tr>`:''}<tr><td>${esc(c[1])}<small>${esc(m.mapping[c[0]]||'Not mapped')}</small></td><td class="numeric">${r?fmt(r.actual):'—'} <small>${esc(r?.unit||c[5])}</small></td><td class="numeric">${r?fmt(r.predicted):'—'}</td><td>${r?dateLabel(r.timestamp):'No sample yet'}${r&&Date.parse(r.timestamp)<dgaTime?'<small>Held from previous sample</small>':''}</td><td>${r?indicatorBadge(r):'—'}</td><td>${r?indicatorBadge(r,true):'—'}</td></tr>`}).join('')}</tbody></table></div></section>
  <details class="note-panel dga-method"><summary>Method and data rules</summary><p>Triangle 1 uses actual methane, ethylene and acetylene in ppm with exactly matching timestamps. Missing, negative, duplicate, non-numeric or zero-total triplets are not classified. Shared boundaries show both regions. No values are interpolated; replay holds the most recent recorded readings and shows their sample times. Rates of change are imported, not calculated.</p><p>Geometry: <a href="https://www.makhillpublications.co/public/files/published-files/mak-ijepe/2010/3-193-197.pdf" target="_blank" rel="noopener">Duval zone coordinates, Table 3 (2010)</a>. Interpretation context: <a href="https://www.vaisala.com/en/calculators/dgacalculator" target="_blank" rel="noopener">Vaisala DGA guidance</a>.</p></details>`;
}
function dgaTrendChart(m){
  if(!m.mapping[dgaTrend]||!m.latest.has(m.mapping[dgaTrend]))return '<div class="empty">No readings for this channel at the replay time.</div>';
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
  if(page!=='dga')return;
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
