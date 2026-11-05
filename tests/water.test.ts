import assert from 'node:assert/strict';
import { test } from 'node:test';
import { instant, parse, parseLive, resolveLive, metric, FLOW_HND, FLOW_GKD, TEMP_NID, TEMP_GKD } from '../lib/water.ts';
const now=Date.parse('2026-11-05T12:00:00Z');
const row=(date:string,value:string)=>`<tr><td>${date} Uhr</td><td>${value}</td></tr>`;
const good=row('05.11.2026 12:30','8,8');
test('German timestamps respect both winter and summer time',()=>{
 assert.equal(new Date(instant('05.11.2026 12:30')).toISOString(),'2026-11-05T11:30:00.000Z');
 assert.equal(new Date(instant('05.07.2026 12:30')).toISOString(),'2026-07-05T10:30:00.000Z');
});
test('error pages with HTTP 200 cannot become readings',()=>{
 assert.throws(()=>parse('<html>Proxy Error</html>'));
 assert.throws(()=>parse('<html>Request Rejected</html>'));
 assert.deepEqual(parse('<html>Login</html>'),[]);
});
test('tables sort newest first and parse decimal commas',()=>{
 const rows=parse(row('04.11.2026 12:30','9.2')+good);
 assert.equal(rows[0].value,8.8);assert.equal(rows[0].date,'05.11.2026 12:30');
});
test('NID is primary and a real 24-hour comparison is used',async()=>{
 const seen:string[]=[];
 const r=await resolveLive('temp',undefined,async url=>{seen.push(url);return good+row('04.11.2026 12:30','9.2');},now);
 assert.deepEqual(seen,[TEMP_NID]);assert.equal(r.stale,false);assert.ok(Math.abs(r.delta24h!+0.4)<1e-9);
});
test('HND HTML with markup around the newest reading parses',()=>{
 const r=parseLive('<p>Letzter Messwert vom <strong>05.11.26 12:30</strong> Uhr: 39 m³/s</p>','flow','HND',FLOW_HND);
 assert.equal(r[0].value,39);assert.equal(r[0].date,'05.11.2026 12:30');
});
test('GKD is tried when primary returns a proxy error',async()=>{
 const seen:string[]=[];
 const r=await resolveLive('temp',undefined,async url=>{seen.push(url);return url===TEMP_NID?'Proxy Error':good;},now);
 assert.deepEqual(seen,[TEMP_NID,TEMP_GKD]);assert.equal(r.reading?.value,8.8);assert.equal(r.stale,false);
});
test('outage preserves original reading and marks it as last known',async()=>{
 const cached=parseLive(good,'temp','NID',TEMP_NID)[0];
 const r=await resolveLive('temp',cached,async()=>{throw new Error('offline');},now);
 assert.equal(r.reading?.measuredAt,cached.measuredAt);assert.equal(r.stale,true);
 assert.equal(metric(r,now).ageMinutes,30);assert.equal(metric(r,now).current,8.8);
});
test('stale primary triggers fallback and cannot overwrite newer stored value',async()=>{
 const cached=parseLive(good,'temp','NID',TEMP_NID)[0];
 const seen:string[]=[];
 const r=await resolveLive('temp',cached,async url=>{seen.push(url);return row('04.11.2026 12:30','9.2');},now);
 assert.deepEqual(seen,[TEMP_NID,TEMP_GKD]);assert.equal(r.reading?.value,8.8);assert.equal(r.stale,true);
});
test('no cache and total outage stays empty, never zero',async()=>{
 const r=await resolveLive('flow',undefined,async()=>{throw new Error('offline');},now);
 assert.equal(metric(r,now).current,null);assert.equal(r.stale,true);
});
test('a lone HND reading has no made-up 24h change',async()=>{
 const r=await resolveLive('flow',undefined,async url=>{assert.equal(url,FLOW_HND);return row('05.11.2026 12:30','39');},now);
 assert.equal(r.delta24h,null);assert.equal(r.reading?.value,39);
});
