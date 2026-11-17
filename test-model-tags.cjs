const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console,Date,setTimeout,clearTimeout,localStorage:{getItem:()=>null}});
for(const name of ['tag-catalog.js','smartsignal.js'])vm.runInContext(fs.readFileSync('dist/'+name,'utf8'),ctx);
const source=fs.readFileSync('dist/app.js','utf8');vm.runInContext(source.slice(0,source.lastIndexOf("document.querySelectorAll('.nav')")),ctx);
const run=s=>vm.runInContext(s,ctx);
const winding=run("modelHoverCard('windings')");
for(const text of ['16.1 kV','9,500 A','82.4 °C','GEN-V-A','GEN-I','WTI-01','16 Nov 2026, 16:00 UTC','Demo data','individual HV/LV coil readings are not mapped'])assert.ok(winding.includes(text),text);
assert.ok(!winding.includes('HV voltage'),'Do not relabel generator voltage as HV coil voltage');
const cooling=run("modelHoverCard('cooling')");assert.ok(cooling.includes('18.6 °C'));assert.ok(cooling.includes('280'));assert.ok(cooling.includes('Unit not supplied'));assert.ok(!cooling.includes('kV'));
assert.ok(run("modelHoverCard('bushings')").includes('No mapped readings'));
assert.ok(run("modelHoverCard('tank')").includes('+13 more tags'));
run("component='tank'");assert.equal((run('componentReadings()').match(/data-model-tag=/g)||[]).length,16);
run("stamp=timestamps()[0]");const historical=run("modelHoverCard('windings')");assert.ok(historical.includes('15 Nov 2026, 16:00 UTC'));assert.ok(!historical.includes('82.4 °C'),'No latest-value leakage into historic snapshots');
run(`data={demo:false,sensors:[
{tag:'custom-v',name:'Custom voltage',component:'bushings',actual:0,unit:'kV',timestamp:'2026-11-16T10:00:00.000Z'},
{tag:'custom-v',name:'Custom voltage',component:'bushings',actual:999,unit:'kV',timestamp:'2026-11-16T12:00:00.000Z'},
{tag:'<img src=x onerror=alert(1)>',name:'<script>alert(1)</script>',component:'cooling',actual:null,unit:'<b>C</b>',timestamp:'2026-11-16T10:00:00.000Z'}
]}; stamp='2026-11-16T11:00:00.000Z';`);
const custom=run("modelHoverCard('bushings')");assert.ok(custom.includes('0 kV'));assert.ok(custom.includes('custom-v'));assert.ok(custom.includes('Imported data'));assert.ok(custom.includes('10:00 UTC'));assert.ok(!custom.includes('999'));
assert.ok(run("modelHoverCard('windings')").includes('No mapped readings'),'No demo fallbacks after import');
const escaped=run("modelHoverCard('cooling')");assert.ok(escaped.includes('&lt;script&gt;'));assert.ok(escaped.includes('&lt;img'));assert.ok(!escaped.includes('<script>'));assert.ok(!escaped.includes('<img'));assert.ok(escaped.includes('—'));
run("component='cooling'");assert.ok(run('componentReadings()').includes('data-model-tag="&lt;img'));
run("stamp='2026-11-16T09:00:00.000Z'");assert.ok(run("modelHoverCard('bushings')").includes('No mapped readings'));
console.log('PASS: model hover/demo readings, actual values/units/timestamps, historical cutoffs, custom component mappings, missing data, zero values, full tag lists and escaped imports.');
assert.equal(run("normalizeComponent('HV bushings')"),'bushings','Legacy import label remains supported');
assert.equal(run("normalizeComponent('HV / LV bushings')"),'bushings');
