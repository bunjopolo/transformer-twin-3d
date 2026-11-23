const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console,Date,setTimeout,clearTimeout,localStorage:{getItem:()=>null}});
for(const file of ['tag-catalog.js','smartsignal.js','duval.js','dga.js','app.js']){let source=fs.readFileSync('dist/'+file,'utf8');if(file==='app.js')source=source.slice(0,source.lastIndexOf("document.querySelectorAll('.nav')"));vm.runInContext(source,ctx);}
const run=s=>vm.runInContext(s,ctx);
run(`var samples=[{time:1000,valid:true,zones:['T1'],percentages:[90,8,2]},{time:2000,valid:true,zones:['T1'],percentages:[91,7,2]},{time:3000,valid:false,reason:'Missing gas'},{time:4000,valid:true,zones:['T1'],percentages:[90,8,2]},{time:5000,valid:true,zones:['DT','T1'],boundary:true,percentages:[80,16,4]}];dgaTime=5000;`);
assert.deepEqual(Array.from(run('duvalTransitions(samples).map(s=>s.time)')),[1000,3000,4000,5000]);
assert.equal(run('duvalMovementHistory(samples,2000).length'),2);
assert.notEqual(run('duvalTimeColor(1000,1000,5000)'),run('duvalTimeColor(5000,1000,5000)'));
const svg=run("dgaTriangle({method:duvalMethod(),series:samples,sample:samples[4]})");assert.equal((svg.match(/stroke-width="2.2"/g)||[]).length,2,'No trajectory across missing sample');assert.ok(svg.includes('Boundary'));assert.ok(!svg.includes('NaN'));
assert.equal(run('duvalMovementHistory(Array.from({length:2000},(_,i)=>({time:i,valid:true})),2000).length'),1000);
assert.ok(run('duvalMovementLegend({series:[]})').includes('No valid trajectory'));
run('var model=dgaModel();');assert.ok(run('duvalMovementTimeline(model)').includes('data-duval-time='));assert.ok(run('dgaCard(model.views[0],model)').includes('duval-absolute'));
console.log('PASS: classification changes, gaps, replay cutoff, colour progression, boundary markers, history cap, empty state and timeline rendering.');

assert.ok(run("duvalDirectionArrow(samples,samples[4],duvalXY)").includes('duval-direction'));
assert.equal(run("duvalDirectionArrow(samples.slice(0,4),samples[3],duvalXY)"),'','No direction across invalid sample');
assert.equal(run("duvalDirectionArrow([samples[0],{...samples[0],time:2000}],{...samples[0],time:2000},duvalXY)"),'','Stationary point has no arrow');
assert.equal(run("duvalDirectionArrow([samples[0]],samples[0],duvalXY)"),'','Single sample has no direction');
console.log('PASS: movement arrow, invalid gap, stationary and single-sample cases.');
