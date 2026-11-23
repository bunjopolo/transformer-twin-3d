const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({console,Date,Map,setTimeout,clearTimeout,setInterval,clearInterval,localStorage:{getItem:()=>null}});
for(const file of ['tag-catalog.js','smartsignal.js','correlations.js','app.js']){let source=fs.readFileSync('dist/'+file,'utf8');if(file==='app.js')source=source.slice(0,source.lastIndexOf("document.querySelectorAll('.nav')"));vm.runInContext(source,ctx);}
const run=s=>vm.runInContext(s,ctx);
assert.equal(run('correlationModel().variables.length'),21);assert.equal(run('correlationModel().matrix[0][0].n'),25);
assert.equal(run('pairedCorrelation(new Map([[1,1],[2,2],[3,3]]),new Map([[1,2],[2,4],[3,6]])).r'),1);
assert.equal(run('pairedCorrelation(new Map([[1,1],[2,2],[3,3]]),new Map([[1,6],[2,4],[3,2]])).r'),-1);
assert.equal(run('pairedCorrelation(new Map([[1,1],[2,1],[3,1]]),new Map([[1,2],[2,4],[3,6]])).r'),null);
assert.equal(run('pairedCorrelation(new Map([[1,1],[2,2],[3,3]]),new Map([[2,2],[3,3],[4,4]])).n'),2);
assert.equal(run('pairedCorrelation(new Map([[1,1],[2,NaN],[3,3]]),new Map([[1,1],[2,2],[3,3]])).r'),null);
run(`data.sensors=[0,1,2,3].flatMap(i=>['A','B'].map(tag=>({tag,name:tag,actual:tag==='A'?i:i*2,unit:'ppm',timestamp:new Date(Date.UTC(2026,0,1,i)).toISOString()})));stamp='2026-01-01T02:00:00.000Z';correlationStart='';correlationEnd='';`);
assert.equal(run('correlationModel().matrix[0][1].n'),3,'No future readings');
run(`correlationStart='2026-01-02';correlationEnd='2026-01-02'`);assert.equal(run('correlationModel().times.length'),0,'Out-of-range readings excluded');
run(`correlationStart='';correlationEnd='';data.sensors.push({...data.sensors[0],actual:999});`);assert.equal(run('correlationModel().matrix[0][1].n'),2,'Duplicate timestamp excluded');
run(`correlationPair=[0,1]`);assert.ok(run('correlationDetail(correlationModel())').includes('Fewer than 3 matched samples'));
run(`data.sensors=[];stamp=''`);assert.equal(run('correlationModel().variables.length'),0);assert.ok(run('correlationsPage()').includes('disabled'));
console.log('PASS: all tags, signed Pearson correlation, constants, missing values, timestamp matching, replay cutoff, window boundaries, duplicates, detail and empty states.');

run(`data.sensors=['2026-01-01T23:59:59.999Z','2026-01-02T00:00:00.000Z','2026-01-02T12:00:00.000Z','2026-01-02T23:59:59.999Z','2026-01-03T00:00:00.000Z'].map((timestamp,i)=>({tag:'A',actual:i,timestamp}));correlationStart='2026-01-02';correlationEnd='2026-01-02';stamp='';`);
assert.equal(run('correlationModel().matrix[0][0].n'),3,'Both UTC day boundaries included');
assert.equal(run('correlationRange().times.length'),3,'Replay restricted to selected dates');
assert.ok(!run('correlationsPage()').includes('correlation-window'));
assert.ok(run('correlationsPage()').includes('type="date"'));
console.log('PASS: inclusive UTC start/end dates and replay range.');
