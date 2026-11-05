import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
process.stdin.once('data',async data=>{
 const env={...process.env,DATABASE_URL:data.toString().trim()};
 const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3190'],{env,stdio:['ignore','pipe','pipe']});
 server.stderr.on('data',()=>{});
 try {
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Start timeout')),15000);server.stdout.on('data',data=>{if(data.toString().includes('Ready')){clearTimeout(timer);resolve();}});});
  console.log('Server ready; loading live metrics');
  const r=await fetch('http://127.0.0.1:3190/api/water-data');const live=await r.json();
  assert.equal(r.status,200);console.log({storageAvailable:live.storageAvailable,flow:live.flow.current,temp:live.temp.current});assert.equal(live.storageAvailable,true);
  for(const kind of ['flow','temp']){assert.equal(typeof live[kind].current,'number');assert.equal(live[kind].stale,false);assert.ok(live[kind].measuredAt);}
  console.log(JSON.stringify({live:{flow:live.flow,temp:live.temp},storageAvailable:live.storageAvailable}));
  const {neon}=await import('@neondatabase/serverless');const sql=neon(env.DATABASE_URL);
  const stored=await sql`SELECT cache_key,payload FROM water_cache WHERE cache_key IN ('live-flow','live-temp')`;
  assert.equal(stored.length,2);console.log('Database persistence verified: two independent station snapshots');
  const {resolveLive,metric}=await import('../lib/water.ts');
  for(const row of stored){const kind=row.cache_key==='live-flow'?'flow':'temp';const result=await resolveLive(kind,row.payload,async()=>{throw new Error('Simulated total upstream outage');});const m=metric(result);assert.equal(m.current,row.payload.value);assert.equal(m.measuredAt,row.payload.measuredAt);assert.equal(m.stale,true);}
  console.log('Total upstream outage verified from persisted snapshots: values and measurement times preserved, stale flag set');
  const page=await fetch('http://127.0.0.1:3190/').then(r=>r.text());assert.ok(page.includes('HND Bayern'));assert.ok(page.includes('NID Bayern'));assert.ok(page.includes('Min. alt'));console.log('SSR page verified: source, measured time and age visible');
  const history=await fetch('http://127.0.0.1:3190/api/water-data?history=1').then(r=>r.json());
  console.log(JSON.stringify({history:Object.fromEntries(Object.entries(history.history).map(([k,v])=>[k,{month:v.month.length,year:v.year.length}]))}));
 }catch(error){console.error(error.message);process.exitCode=1;}finally{server.kill();process.exit(process.exitCode ?? 0);}
});
