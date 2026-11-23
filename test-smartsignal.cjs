const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const XLSX=require('./dist/vendor/xlsx.full.min.js');
let persisted='';
const ctx=vm.createContext({XLSX,Date,structuredClone,setTimeout,clearTimeout,console,localStorage:{getItem:()=>null,setItem:(k,v)=>persisted=v}});
vm.runInContext(fs.readFileSync('dist/tag-catalog.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('dist/smartsignal.js','utf8'),ctx);
const source=fs.readFileSync('dist/app.js','utf8');
vm.runInContext(source.slice(0,source.lastIndexOf("document.querySelectorAll('.nav')")),ctx);
vm.runInContext('render=()=>{};notify=()=>{};go=()=>{};',ctx);
const run=s=>vm.runInContext(s,ctx);
const wb=XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
 ['Fictional export'],[],['Timestamp','Actual','Estimate','Residual','Residual Smoothed','Advisory Indication','Diagnostic Advisory Indication'],
 ['2026-11-16T12:00:00Z',0,0,999,999,0,1],
 ['2026-11-16T13:00:00Z',72,70,999,999,'unrecognized',''],
]),'PI-TAG-A');
XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
 ['Diagnostic Advisory Indication','Estimate','Time','Advisory Indication','Actual'],
 [false,61,'2026-11-16T12:00:00Z',true,62],
]),'PI-TAG-B');
XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Notes'],['Not a tag']]),'Readme');
ctx.workbook=XLSX.read(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),{type:'buffer',raw:true});
run("pending=initSmart(workbook,'synthetic.xlsx')");
run("pending.indicationMode='encoded'");
assert.equal(run('pending.sheets[0].headerRow'),3);
assert.equal(run('pending.sheets[2].included'),false);
assert.ok(run("validateSmart(pending).errors.some(e=>e.includes('choose a transformer component'))"));
run("pending.sheets[0].component='windings';pending.sheets[1].component='tank';");
assert.equal(run('validateSmart(pending).errors.length'),0);
assert.equal(run('validateSmart(pending).rows.length'),3);
assert.equal(run('validateSmart(pending).rows[0].tag'),'PI-TAG-A');
assert.equal(run('validateSmart(pending).rows[0].actual'),0);
assert.equal(run('validateSmart(pending).rows[0].advisoryActive'),false);
assert.equal(run('validateSmart(pending).rows[0].diagnosticActive'),true);
assert.equal(run('validateSmart(pending).rows[0].severity'),'watch');
assert.equal(run('validateSmart(pending).rows[1].advisoryActive'),null);
assert.equal(run('validateSmart(pending).rows[1].diagnosticActive'),null);
assert.equal(run('validateSmart(pending).rows[1].severity'),'unknown');
assert.equal(run('validateSmart(pending).rows[1].advisoryIndication'),'unrecognized');
assert.equal(run('validateSmart(pending).rows[2].advisoryActive'),true);
assert.equal(run('validateSmart(pending).rows[2].diagnosticActive'),false);
assert.equal(run("'residual' in validateSmart(pending).rows[0]"),false);
assert.equal(run("indicatorState(2,pending)"),null);
run("pending.activeTokens='0,1';");assert.ok(run("validateSmart(pending).errors.some(e=>e.includes('overlap'))"));
run("pending.activeTokens='1,true,yes,active';pending.blankInactive=true;pending.sheets[0].map.diagnosticAdvisoryIndication=-1;");
assert.equal(run('validateSmart(pending).rows[0].diagnosticActive'),null,'Unmapped columns must not become clear');
run("refreshSmartSheet(pending.sheets[0]);pending.blankInactive=false;pending.dateOrder='MDY';pending.offset=-480;");
assert.equal(run("smartDate('11/16/2026 8:30 AM',pending)"),'2026-11-16T16:30:00.000Z');
assert.equal(run("smartDate('2026-11-16T08:30:00-07:00',pending)"),'2026-11-16T15:30:00.000Z');
assert.equal(run("smartDate('02/30/2026 8:30 AM',pending)"),'');
run("pending.sheets[0].records.push(pending.sheets[0].records[0]);");assert.ok(run("validateSmart(pending).errors.some(e=>e.includes('duplicate timestamp'))"));
run("pending.sheets[0].records.pop();pending.sheets[0].records[0].cells[1]='';");assert.ok(run("validateSmart(pending).errors.some(e=>e.includes('Actual must be numeric'))"));
run("pending.sheets[0].records[0].cells[1]=0;pending.offset=0;applySmart();");
assert.equal(run('data.sensors.length'),3);
assert.equal(run('data.health.length'),0,'No health scores invented from flags');
assert.equal(run('data.maintenance.length'),0,'Sample data cleared on first import');
assert.equal(JSON.parse(persisted).sensors[0].diagnosticActive,true);
run("pending=initSmart(workbook,'next.xlsx');");
assert.equal(run('pending.sheets[0].component'),'windings','Tag-to-component mapping reused');
run("data.maintenance=[{title:'Keep imported maintenance'}];data.health=[{score:81}];applySmart();");
assert.equal(run('data.maintenance.length'),1);
assert.equal(run('data.health[0].score'),81);
// User-described SmartSignal text messages: preserve both strings exactly.
run("pending=initSmart(workbook,'text-messages.xlsx');pending.sheets[0].records[0].cells[5]='LOW_TAG fired for MCA_U02_GenAirCW_Flow_00';pending.sheets[0].records[0].cells[6]='Sensor Failure - Gen CW Flow';pending.sheets[0].records[1].cells[5]='';pending.sheets[0].records[1].cells[6]='';");
assert.equal(run('validateSmart(pending).rows[0].advisoryActive'),true);
assert.equal(run('validateSmart(pending).rows[0].diagnosticActive'),true);
assert.equal(run('validateSmart(pending).rows[0].advisoryIndication'),'LOW_TAG fired for MCA_U02_GenAirCW_Flow_00');
assert.equal(run('validateSmart(pending).rows[0].diagnosticAdvisoryIndication'),'Sensor Failure - Gen CW Flow');
assert.equal(run('validateSmart(pending).rows[1].advisoryActive'),false);
assert.equal(run('validateSmart(pending).rows[1].diagnosticActive'),false);
assert.ok(run("indicatorBadge(validateSmart(pending).rows[1]).includes('None supplied')"));
run("pending.sheets[0].records[1].cells[6]='Different unit-specific diagnostic <check>'; ");
assert.equal(run('validateSmart(pending).rows[1].advisoryActive'),false);
assert.equal(run('validateSmart(pending).rows[1].diagnosticActive'),true);
assert.ok(run("indicatorBadge(validateSmart(pending).rows[1],true).includes('&lt;check&gt;')"));
console.log('PASS: XLSX worksheet-per-tag import, header detection, reordered columns, excluded sheets, component linking, independent flags, unknowns, zero/blank handling, duplicate detection, date offsets, persistence and preservation of maintenance/health.');

run("pending=initSmart(smartExampleBook(), 'phase-a-example.xlsx');");
assert.equal(run("pending.sheets.length"),21);
assert.equal(run("validateSmart(pending).rows.length"),525);
assert.equal(run("validateSmart(pending).errors.length"),0);
assert.equal(run("TAG_CATALOG.filter(r=>r[6]==='DGA concentrations').length"),11);
assert.equal(run("TAG_CATALOG.filter(r=>r[6]==='DGA rates of change').length"),5);
console.log("PASS: Phase A catalog and 21-sheet example workbook mappings.");

// Combine the presentation while preserving both imported source fields.
run(`combinedRow={tag:'COMBINED',component:'windings',timestamp:'2026-11-16T16:00:00.000Z',indicationMode:'text',advisoryActive:true,diagnosticActive:true,advisoryIndication:'High temperature',diagnosticAdvisoryIndication:'Inspect <sensor>',advisory:'Old cached display'};`);
assert.equal(run('advisoryText(combinedRow)'), 'High temperature\nInspect <sensor>');
assert.ok(run('combinedAdvisories(combinedRow)').includes('Inspect &lt;sensor&gt;'));
assert.equal(run("advisoryText({...combinedRow,diagnosticAdvisoryIndication:'High temperature'})"),'High temperature');
assert.equal(run('advisoryText({...combinedRow,advisoryActive:false})'),'Inspect <sensor>');
assert.ok(run('combinedAdvisories({advisoryActive:false,diagnosticActive:false})').includes('None supplied'));
assert.ok(run('combinedAdvisories({advisoryActive:false,diagnosticActive:null})').includes('Not supplied'));
assert.equal(run("advisoryText({advisory:'Legacy message'})"),'Legacy message');
assert.equal(run('signalText({advisoryActive:true,diagnosticActive:true})'),'Advisory active. No message supplied.');
run("data.sensors=[combinedRow];stamp='';component='windings';");
assert.equal(run("statusFor('windings')"),'watch');
assert.equal((run('overview()').match(/class="advisory-item"/g)||[]).length,1,'Count an affected tag once');
assert.ok(run('componentPanel()').includes('Inspect &lt;sensor&gt;'));
assert.ok(!run('sensorTable()').includes('DIAGNOSTIC ADVISORY INDICATION'));
assert.equal(run('combinedRow.diagnosticAdvisoryIndication'),'Inspect <sensor>');
console.log('PASS: combined messages, diagnostic-only advisories, deduplication, escaped text, missing fields, legacy data and one entry per tag.');
