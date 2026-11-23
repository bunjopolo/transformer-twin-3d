'use strict';
// Import the user-described worksheet-per-tag export, without assuming a vendor schema.
const SMART_FIELDS = {
  timestamp: {label:'Timestamp', aliases:['timestamp','time','datetime','dateandtime','timecode','date']},
  actual: {label:'Actual', aliases:['actual','actualvalue','actualvalues']},
  predicted: {label:'Estimate', aliases:['estimate','estimated','estimatedvalue','estimatevalue','estimatevalues','predicted','predictedvalue']},
  advisoryIndication: {label:'Advisory indication', aliases:['advisoryindication','advisoryindicator','advisory']},
  diagnosticAdvisoryIndication: {label:'Diagnostic advisory indication', aliases:['diagnosticadvisoryindication','diagnosticadvisoryindicator','diagnosticadvisory']}
};
function smartMap(headers) {
  return Object.fromEntries(Object.entries(SMART_FIELDS).map(([key,field])=>[key,headers.findIndex(h=>field.aliases.includes(norm(h)))]));
}
function prepareSmartSheet(book, name, remembered={}) {
  const known=catalogTag(name);
  if(known)remembered={component:known[2],name:known[1],unit:known[5],...remembered};
  const sheet=book.Sheets[name];
  const grid=XLSX.utils.sheet_to_json(sheet,{header:1,range:0,defval:'',raw:true,blankrows:true});
  let headerRow=1,best=-1;
  grid.slice(0,30).forEach((row,i)=>{
    const mapping=smartMap(row);const score=Object.values(mapping).filter(v=>v>=0).length;
    if(score>best){best=score;headerRow=i+1;}
  });
  const item={sheet:name,grid,headerRow,component:remembered.component||'',name:remembered.name||name,unit:remembered.unit||'',included:best>=2,fullRange:sheet['!fullref']||'',map:{}};
  refreshSmartSheet(item);
  return item;
}
function refreshSmartSheet(item) {
  item.headers=(item.grid[item.headerRow-1]||[]).map(String);
  item.map=smartMap(item.headers);
  item.records=item.grid.slice(item.headerRow).map((cells,i)=>({cells,row:item.headerRow+i+1})).filter(r=>r.cells.some(v=>v!==''));
}
function initSmart(book,file) {
  const sheets=book.SheetNames.map(name=>prepareSmartSheet(book,name,data.tagMappings?.[name]));
  return {mode:'smart',book,file,sheets,selected:Math.max(0,sheets.findIndex(s=>s.included)),activeTokens:'1, true, yes, active',inactiveTokens:'0, false, no, inactive',blankInactive:false,dateOrder:'ISO',offset:0,...data.signalSettings,indicationMode:'text'};
}
function indicatorState(value, config) {
  const token=String(value??'').trim().toLowerCase();
  if(config.indicationMode==='text')return Boolean(token);
  if(!token)return config.blankInactive?false:null;
  const tokens=s=>s.split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
  if(tokens(config.activeTokens).includes(token))return true;
  if(tokens(config.inactiveTokens).includes(token))return false;
  return null;
}
function signalText(r) {
  if(r.indicationMode==='text')return [...new Set([r.advisoryActive===true?r.advisoryIndication:'',r.diagnosticActive===true?r.diagnosticAdvisoryIndication:''].filter(v=>String(v??'').trim()))].join('\n');
  return r.advisoryActive===true||r.diagnosticActive===true?'Advisory active. No message supplied.':'';
}
function advisoryText(r) {
  return r.indicationMode==='text'||r.signalFormat==='SmartSignal'?signalText(r):r.advisory||signalText(r);
}
function combinedAdvisories(r) {
  const text=advisoryText(r);
  if(text)return `<span class="source-indication advisory-text">${esc(text)}</span>`;
  return `<span class="muted">${r.advisoryActive===false&&r.diagnosticActive===false?'None supplied':'Not supplied'}</span>`;
}
function indicatorBadge(r, diagnostic=false) {
  const key=diagnostic?'diagnosticAdvisoryIndication':'advisoryIndication';
  const active=r[diagnostic?'diagnosticActive':'advisoryActive'];
  if(!(key in r))return '<span class="muted">Not supplied</span>';
  if(r.indicationMode==='text')return String(r[key]??'').trim()?`<span class="source-indication advisory-text">${esc(r[key]??'')}</span>`:`<span class="muted">${active===false?'None supplied':'Not supplied'}</span>`;
  return `${badge(active===true?'watch':active===false?'normal':'unknown',active===true?'Active':active===false?'Clear':'Unknown')}<small class="source-indication">Source: ${esc(String(r[key]??'').trim()||'(blank)')}</small>`;
}
function smartDate(value, config) {
  let v=value;
  if(typeof v==='string'&&config.dateOrder!=='ISO') {
    const m=v.trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
    if(m){let hour=Number(m[4]||0);if(m[7]){if(hour<1||hour>12)return '';hour=hour%12+(/pm/i.test(m[7])?12:0);}const mo=config.dateOrder==='MDY'?m[1]:m[2],day=config.dateOrder==='MDY'?m[2]:m[1];v=`${m[3]}-${mo.padStart(2,'0')}-${day.padStart(2,'0')}T${String(hour).padStart(2,'0')}:${m[5]||'00'}:${m[6]||'00'}`;}
  }
  const parsed=parseDate(v);
  if(!parsed)return '';
  const explicit=typeof v==='string'&&/[T ].*(Z|[+-]\d{2}:?\d{2})$/i.test(v);
  return explicit?parsed:new Date(new Date(parsed).getTime()-Number(config.offset)*60000).toISOString();
}
function validateSmart(p) {
  const errors=[],warnings=[],rows=[],summary=[];
  const active=p.activeTokens.split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
  const inactive=p.inactiveTokens.split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
  if(p.indicationMode!=='text'){
    if(!active.length||!inactive.length)errors.push('Provide at least one active and one inactive indication value.');
    if(active.some(v=>inactive.includes(v)))errors.push('Active and inactive indication values must not overlap.');
  }
  const selected=p.sheets.filter(s=>s.included);
  if(!selected.length)errors.push('Include at least one tag worksheet.');
  if(selected.reduce((n,s)=>n+s.records.length,0)>100000)errors.push('Use at most 100,000 total readings per workbook.');
  if(errors.length)return {rows,errors,warnings,summary};
  for(const s of selected){
    const start=errors.length,seen=new Set();let unknown=0;
    if(!COMPONENTS[s.component])errors.push(`${s.sheet}: choose a transformer component.`);
    for(const field of ['timestamp','actual','predicted'])if(s.map[field]<0)errors.push(`${s.sheet}: map ${SMART_FIELDS[field].label}.`);
    const used=Object.values(s.map).filter(i=>i>=0);
    if(new Set(used).size!==used.length)errors.push(`${s.sheet}: each field needs a different source column.`);
    if(s.records.length>20000||s.fullRange)errors.push(`${s.sheet}: exceeds the 20,000-row limit or was truncated. Use a smaller export.`);
    if(!s.records.length)errors.push(`${s.sheet}: no data rows after the header.`);
    if(errors.length>start){summary.push({sheet:s.sheet,count:0,unknown:0,errors:errors.length-start});continue;}
    for(const record of s.records){
      const get=f=>s.map[f]>=0?record.cells[s.map[f]]??'':'';
      const timestamp=smartDate(get('timestamp'),p),actual=get('actual'),estimate=get('predicted');
      const prefix=`${s.sheet}, row ${record.row}`;
      if(!timestamp)errors.push(`${prefix}: timestamp is invalid. Check date order and source timezone.`);
      if(timestamp&&seen.has(timestamp))errors.push(`${prefix}: duplicate timestamp for this tag.`);
      seen.add(timestamp);
      for(const [label,v] of [['Actual',actual],['Estimate',estimate]])if(String(v).trim()===''||typeof v==='boolean'||!Number.isFinite(Number(v)))errors.push(`${prefix}: ${label} must be numeric, including zero.`);
      const a=get('advisoryIndication'),d=get('diagnosticAdvisoryIndication');
      // Unmapped columns always remain unknown, regardless of blank-cell settings.
      const advisoryActive=s.map.advisoryIndication<0?null:indicatorState(a,p);
      const diagnosticActive=s.map.diagnosticAdvisoryIndication<0?null:indicatorState(d,p);
      if(advisoryActive===null||diagnosticActive===null)unknown++;
      const r={timestamp,tag:s.sheet,name:s.name||s.sheet,component:s.component,unit:s.unit,actual:Number(actual),predicted:Number(estimate),advisoryIndication:a,diagnosticAdvisoryIndication:d,advisoryActive,diagnosticActive,indicationMode:p.indicationMode,sourceSheet:s.sheet,sourceFile:p.file,signalFormat:'SmartSignal'};
      r.severity=advisoryActive===true||diagnosticActive===true?'watch':advisoryActive===null||diagnosticActive===null?'unknown':'normal';
      r.advisory=signalText(r);rows.push(r);
    }
    if(unknown)warnings.push(`${s.sheet}: ${unknown} readings have an unknown indication. Original values will be retained.`);
    summary.push({sheet:s.sheet,count:s.records.length,unknown,errors:errors.length-start});
  }
  return {rows,errors,warnings,summary};
}
function smartStage() {
  const p=pending,s=p.sheets[p.selected];
  return `<div class="import-alert"><strong>${esc(p.file)}</strong></div>
  <div class="toolbar smart-toolbar"><button class="link-button" id="switch-flat">Maintenance / table import</button><button class="link-button" id="cancel-smart">Cancel</button></div>
  <h3 class="import-step">1. Assign components</h3>
  <div class="table-wrap smart-sheets"><table><thead><tr><th>IMPORT</th><th>TAG / WORKSHEET</th><th>COMPONENT</th><th>SETUP</th></tr></thead><tbody>${p.sheets.map((sheet,i)=>`<tr class="${i===p.selected?'selected-sheet':''}"><td><input type="checkbox" aria-label="Include ${esc(sheet.sheet)}" data-include="${i}" ${sheet.included?'checked':''}></td><td><span class="table-tag">${esc(sheet.sheet)}</span><small>${sheet.records.length} rows</small></td><td><select aria-label="Component for ${esc(sheet.sheet)}" data-smart-component="${i}"><option value="">Choose component…</option>${componentOptions(sheet.component)}</select></td><td><button class="btn" data-configure="${i}" aria-label="Configure ${esc(sheet.sheet)}">${i===p.selected?'Editing':'Configure'}</button></td></tr>`).join('')}</tbody></table></div>
  <h3 class="import-step">2. Columns · <span class="table-tag">${esc(s.sheet)}</span></h3>
  <div class="mapping"><label>Header row<input id="smart-header" type="number" min="1" max="30" value="${s.headerRow}"></label><label>Display name<input id="smart-name" value="${esc(s.name)}"></label><label>Unit (optional)<input id="smart-unit" value="${esc(s.unit)}" placeholder="e.g. °C"></label></div>
  <div class="mapping">${Object.entries(SMART_FIELDS).map(([f,field])=>`<label>${field.label}${['timestamp','actual','predicted'].includes(f)?' *':''}<select data-smart-map="${f}"><option value="-1">${f.includes('Indication')?'Not supplied → Unknown':'— Select column —'}</option>${s.headers.map((h,i)=>`<option value="${i}" ${s.map[f]===i?'selected':''}>${XLSX.utils.encode_col(i)} · ${esc(h||'(blank header)')}</option>`).join('')}</select></label>`).join('')}</div>
  <button class="btn" id="copy-smart-map">Apply mapping to included tags</button>
  <h3 class="import-step">3. Timestamps</h3>

  <div class="mapping"><label>Text date order<select id="smart-date-order">${[['ISO','ISO: YYYY-MM-DD'],['MDY','Month / day / year'],['DMY','Day / month / year']].map(([v,t])=>`<option value="${v}" ${p.dateOrder===v?'selected':''}>${t}</option>`).join('')}</select></label><label>Timezone for dates without an offset<select id="smart-offset">${[[-480,'UTC−08:00 (fixed offset)'],[-420,'UTC−07:00 (fixed offset)'],[0,'UTC+00:00'],[60,'UTC+01:00'],[120,'UTC+02:00']].map(([v,t])=>`<option value="${v}" ${Number(p.offset)===v?'selected':''}>${t}</option>`).join('')}</select></label></div>
  <p class="muted">Explicit offsets take precedence. Fixed offsets exclude DST; split exports at offset changes.</p>
  <div id="smart-validation">${smartValidationView()}</div>`;
}
function smartValidationView(){
  const v=validateSmart(pending),preview=v.rows.filter(r=>r.tag===pending.sheets[pending.selected].sheet).slice(0,3);
  return `<h3 class="import-step">4. Review</h3><div class="import-alert ${v.errors.length?'error':''}"><strong>${v.errors.length?`${v.errors.length} issues`:`✓ ${v.rows.length} readings · ${v.summary.length} tags`}</strong>${v.errors.length?'<br>'+v.errors.slice(0,8).map(esc).join('<br>'):''}${v.errors.length>8?'<br>More issues are present in the selected sheets.':''}<br>${data.demo?'Clears all demo records.':'Replaces all sensor readings; retains maintenance records.'}</div>
  ${v.warnings.length?`<div class="import-alert">${v.warnings.slice(0,8).map(esc).join('<br>')}</div>`:''}
  <div class="table-wrap import-preview"><table><thead><tr><th>TIMESTAMP (UTC)</th><th>ACTUAL</th><th>ESTIMATE</th><th>ADVISORIES</th></tr></thead><tbody>${preview.map(r=>`<tr><td>${esc(r.timestamp)}</td><td>${fmt(r.actual)}</td><td>${fmt(r.predicted)}</td><td>${combinedAdvisories(r)}</td></tr>`).join('')}</tbody></table></div><p class="muted">Preview: first 3 readings.</p>
  <button class="btn primary" id="apply-smart" ${v.errors.length?'disabled':''}>Import ${v.summary.length} tags</button>`;
}
function applySmart(){
  const p=pending,v=validateSmart(p);if(v.errors.length)return;
  const next=data.demo?{sensors:[],maintenance:[],health:[],imports:[],demo:false}:structuredClone(data);
  next.sensors=v.rows;next.source=p.file;next.tagMappings={...next.tagMappings};
  for(const s of p.sheets.filter(s=>s.included))next.tagMappings[s.sheet]={component:s.component,name:s.name,unit:s.unit};
  next.imports.push({file:p.file,type:'SmartSignal · '+v.summary.length+' tags',count:v.rows.length,time:new Date().toISOString()});
  next.signalSettings={indicationMode:p.indicationMode,dateOrder:p.dateOrder,offset:p.offset};
  if(save(next)){stamp='';pending=null;go('overview');notify(`${v.rows.length} readings from ${v.summary.length} tags imported.`);}
}
function bindSmart(){
  if(!$('#smart-validation'))return;
  const p=pending,s=p.sheets[p.selected];
  const refresh=()=>{$('#smart-validation').innerHTML=smartValidationView();$('#apply-smart').onclick=applySmart;};
  $('#cancel-smart').onclick=()=>{pending=null;render();};
  $('#switch-flat').onclick=()=>{pending={file:p.file,book:p.book,sheet:p.book.SheetNames[0],type:'Sensors',mode:'flat'};loadSheet();render();};
  document.querySelectorAll('[data-include]').forEach(el=>el.onchange=()=>{p.sheets[Number(el.dataset.include)].included=el.checked;refresh();});
  document.querySelectorAll('[data-smart-component]').forEach(el=>el.onchange=()=>{p.sheets[Number(el.dataset.smartComponent)].component=el.value;refresh();});
  document.querySelectorAll('[data-configure]').forEach(el=>el.onclick=()=>{p.selected=Number(el.dataset.configure);render();});
  $('#smart-header').onchange=e=>{s.headerRow=Math.min(30,Math.max(1,Number(e.target.value)||1));refreshSmartSheet(s);render();};
  $('#smart-name').onchange=e=>{s.name=e.target.value.trim();refresh();};$('#smart-unit').onchange=e=>{s.unit=e.target.value.trim();refresh();};
  document.querySelectorAll('[data-smart-map]').forEach(el=>el.onchange=()=>{s.map[el.dataset.smartMap]=Number(el.value);refresh();});
  $('#copy-smart-map').onclick=()=>{for(const other of p.sheets.filter(x=>x.included&&x!==s)){for(const f of Object.keys(SMART_FIELDS)){other.map[f]=s.map[f]<0?-1:other.headers.findIndex(h=>norm(h)===norm(s.headers[s.map[f]]));}}refresh();notify('Column mapping copied by header name. Review any missing columns.');};
  for(const [id,key] of [['smart-date-order','dateOrder'],['smart-offset','offset']])$('#'+id).onchange=e=>{p[key]=e.target.value;refresh();};
  $('#apply-smart').onclick=applySmart;
}
function smartExampleBook(){
  const book=XLSX.utils.book_new(),sample=demoData();
  for(const tag of [...new Set(sample.sensors.map(r=>r.tag))]){
    const rows=sample.sensors.filter(r=>r.tag===tag).map(r=>({'Timestamp':r.timestamp,'Actual':r.actual,'Estimate':r.predicted,'Residual':+(r.actual-r.predicted).toFixed(2),'Residual Smoothed':0,'Advisory Indication':r.advisoryIndication,'Diagnostic Advisory Indication':r.diagnosticAdvisoryIndication}));
    const sheet=XLSX.utils.json_to_sheet(rows);sheet['!cols']=[{wch:28},...Array.from({length:6},()=>({wch:25}))];XLSX.utils.book_append_sheet(book,sheet,tag);
  }
  return book;
}
function loadSmartExample(){pending=initSmart(smartExampleBook(),'SmartSignal example.xlsx');render();notify('Example loaded. Link each tag to a transformer component.');}
