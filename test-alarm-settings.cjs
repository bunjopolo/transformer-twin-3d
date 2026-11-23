const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const storage=new Map();
function context(){const ctx=vm.createContext({console,Date,setTimeout,clearTimeout,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}});for(const file of ['tag-catalog.js','smartsignal.js','dga.js','app.js']){let s=fs.readFileSync('dist/'+file,'utf8');if(file==='app.js')s=s.slice(0,s.lastIndexOf("document.querySelectorAll('.nav')"));vm.runInContext(s,ctx);}return ctx;}
let ctx=context(),run=s=>vm.runInContext(s,ctx);
assert.equal(run('alarmTags().length'),16);assert.ok(run('settingsPage()').includes('Save limits'));
assert.equal(run('validateAlarmLimit(true,null,null)'), 'Enter at least one limit or disable this tag.');
assert.ok(run('validateAlarmLimit(true,10,10)'));assert.ok(run('validateAlarmLimit(true,11,10)'));assert.ok(run('validateAlarmLimit(true,Infinity,20)'));assert.equal(run('validateAlarmLimit(false,null,null)'),'');assert.equal(run('validateAlarmLimit(true,0,null)'),'');
run(`alarmSettings={'DGA-H2':{unit:'ppm',enabled:true,warning:10,alarm:20}}`);
for(const [actual,label] of [[0,'Within limits'],[10,'Warning'],[19,'Warning'],[20,'Alarm'],[null,'No reading']])assert.equal(run(`limitState({tag:'DGA-H2',unit:'ppm',actual:${actual}}).label`),label);
assert.equal(run("limitState({tag:'DGA-H2',unit:'ppb',actual:100}).label"),'Not configured');
run(`stamp=timestamps()[0];alarmSettings['DGA-H2'].warning=0;alarmSettings['DGA-H2'].alarm=1;`);assert.ok(run("chart('DGA-H2')").includes('Alarm'));
// Exercise actual save handler and reload from browser storage.
run(`var errorBox={textContent:''},savedMessage='';var inputs={enabled:{checked:true},warning:{value:'12'},alarm:{value:'24'}};var row={dataset:{alarmRow:'0'},querySelector:s=>inputs[s.match(/data-limit="(.*?)"/)[1]]};var form={querySelectorAll:()=>[row]};var document={querySelector:s=>s==='#alarm-settings-form'?form:errorBox};notify=s=>savedMessage=s;bindAlarmSettings();form.onsubmit({preventDefault(){}});`);
assert.equal(run('savedMessage'),'DGA alarm limits saved.');const first=run('alarmTags()[0].tag');assert.equal(JSON.parse(storage.get('field-twin-dga-limits-v1'))[first].alarm,24);
ctx=context();assert.equal(run(`alarmSettings[${JSON.stringify(first)}].warning`),12);
storage.set('field-twin-dga-limits-v1','broken');ctx=context();assert.equal(run('Object.keys(alarmSettings).length'),0);
console.log('PASS: settings render, threshold validation, inclusive boundaries, missing data, units, chart badges, save handler, reload and corrupt-storage recovery.');
