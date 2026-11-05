import { NextResponse } from "next/server";
import { parse, instant, resolveLive, metric, fresh, type Point, type Reading } from "@/lib/water";
import { readCache, saveCache } from "@/lib/water-cache";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const BASE = "https://www.gkd.bayern.de/de/fluesse";
const DAY = 86_400_000;
const formatted = (p: Point) => ({ label: p.date.slice(0, 6), value: p.value, date: p.date });
// One point per calendar day keeps the rolling window evenly spaced.
// Historical daily means cover days outside the source's current-month table.
function rollingMonth(recent: Point[], daily: Point[], end: number) {
  const start = end - 28 * DAY;
  const byDay = new Map<number, Point>();
  for (const point of daily) {
    const time = timestamp(point.date);
    if (time >= start && time <= end) byDay.set(time, point);
  }
  const groups = new Map<number, Point[]>();
  for (const point of recent) {
    const time = timestamp(point.date);
    if (time >= start && time <= end) groups.set(time, [...(groups.get(time) ?? []), point]);
  }
  for (const [time, points] of groups) {
    if (byDay.has(time) && time < end) continue;
    byDay.set(time, {
      date: points[0].date.slice(0, 10),
      value: points.reduce((sum, point) => sum + point.value, 0) / points.length,
    });
  }
  return [...byDay.entries()].sort(([a], [b]) => a - b).map(([, point]) => formatted(point));
}
function timestamp(date: string) {
  const [day, month, year] = date.slice(0, 10).split(".").map(Number);
  return Date.UTC(year, month - 1, day);
}
function weekly(points: Point[]) {
  const today = new Date();
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const start = end - 364 * DAY;
  const byDay = new Map<string, Point>();
  for (const point of points) byDay.set(point.date.slice(0, 10), point);
  const buckets = new Map<number, Point[]>();
  for (const point of byDay.values()) {
    const time = timestamp(point.date);
    if (time < start || time > end) continue;
    const index = Math.floor((time - start) / (7 * DAY));
    buckets.set(index, [...(buckets.get(index) ?? []), point]);
  }
  return [...buckets.entries()].sort(([a], [b]) => a - b).map(([, bucket]) => {
    const latest = bucket.reduce((a, b) => timestamp(a.date) > timestamp(b.date) ? a : b);
    return {
      label: latest.date.slice(0, 6),
      date: latest.date,
      value: bucket.reduce((sum, point) => sum + point.value, 0) / bucket.length,
    };
  });
}

async function html(url:string) {
  const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(9000),headers:{"User-Agent":"Mozilla/5.0 (compatible; EiskanalDashboard/2.0)"}});
  if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
  return response.text();
}
export async function GET(request?: Request) {
  let storageAvailable=true;
  const cache=await readCache().catch(() => {storageAvailable=false;return [];});
  const entry=(key:string)=>cache.find(row=>row.cache_key===key);
  const recent=(key:string,ttl:number)=>{const row=entry(key);return row && Date.now()-Date.parse(row.fetched_at)<ttl ? row : undefined;};
  const store=async (key:string,payload:unknown,at:string)=>{
    try {await saveCache(key,payload,at);} catch {storageAvailable=false;}
  };
  if (request && new URL(request.url).searchParams.get('history')==='1') {
    const today = new Intl.DateTimeFormat("de-DE", {timeZone:"Europe/Berlin"}).format(new Date());
    const end=timestamp(today), year=new Date(end).getUTCFullYear();
    const start=new Date(end-28*DAY).toLocaleDateString('de-DE',{timeZone:'UTC',day:'2-digit',month:'2-digit',year:'numeric'});
    const history=await Promise.all((['flow','temp'] as const).map(async kind=>{
      const key='history-'+kind;
      const saved=recent(key,DAY);
      if(saved) return [kind,saved.payload];
      const path=kind==='flow'?'abfluss/bayern/haunstetten-12003500':'wassertemperatur/kelheim/augsburg-hochablass-12004002';
      const urls=[`${BASE}/${path}/monatswerte/tabelle?beginn=${start}&ende=${today}`,`${BASE}/${path}/jahreswerte/tabelle`,`${BASE}/${path}/jahreswerte/tabelle?beginn=01.01.${year-1}&ende=31.12.${year-1}`];
      const tables=await Promise.allSettled(urls.map(async url=>{const p=parse(await html(url));if(!p.length)throw new Error('Empty history');return p;}));
      const rows=tables.map(r=>r.status==='fulfilled'?r.value:[]);
      const old=entry(key)?.payload as {month:unknown[];year:unknown[]}|undefined;
      const data={month:rollingMonth(rows[0],[...rows[2],...rows[1]],end),year:weekly([...rows[2],...rows[1]])};
      if(!data.month.length && old) data.month=old.month as typeof data.month;
      if(!data.year.length && old) data.year=old.year as typeof data.year;
      if(tables.every(r=>r.status==='fulfilled')) await store(key,data,new Date().toISOString());
      return [kind,data];
    }));
    return NextResponse.json({history:Object.fromEntries(history),storageAvailable},{headers:{'Cache-Control':'no-store'}});
  }
  const results=await Promise.all((['flow','temp'] as const).map(async kind=>{
    const key='live-'+kind;
    const saved=entry(key)?.payload as Reading|undefined;
    // Reuse only recently confirmed, fresh successful measurements.
    if(saved && recent(key,300000) && fresh(saved)) return metric({reading:saved,stale:false,delta24h:null});
    const result=await resolveLive(kind,saved,html);
    if(result.reading && !result.stale) await store(key,result.reading,result.reading.measuredAt);
    return metric(result);
  }));
  return NextResponse.json({flow:results[0],temp:results[1],source:'LfU Bayern · HND / NID; Ersatz: GKD',storageAvailable},{headers:{'Cache-Control':'no-store'}});
}
