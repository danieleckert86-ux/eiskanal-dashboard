import type { VercelRequest,VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

const FLOW_LIVE='https://www.hnd.bayern.de/pegel/iller_lech/haunstetten-12003500/abfluss?days=31';
const FLOW_MONTH='https://www.gkd.bayern.de/de/fluesse/abfluss/bayern/haunstetten-12003500/monatswerte';
const FLOW_YEAR='https://www.gkd.bayern.de/de/fluesse/abfluss/bayern/haunstetten-12003500/jahreswerte';
const TEMP_LIVE='https://www.nid.bayern.de/wassertemperatur/iller_lech/augsburg-hochablass-12004002/tabelle';
const TEMP_YEAR='https://www.gkd.bayern.de/de/fluesse/wassertemperatur/bayern/augsburg-hochablass-12004002/jahreswerte';
const WEATHER='https://api.open-meteo.com/v1/forecast?latitude=48.34645&longitude=10.93594&current=temperature_2m,apparent_temperature,precipitation,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&wind_speed_unit=kmh&timezone=Europe%2FBerlin&forecast_days=7';

function clean(s:string){return s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim()}
function deNum(s:string){return Number(s.replace(/\./g,'').replace(',','.'))}
function isoDate(d:string,time?:string){const[a,b,c]=d.split('.');const y=c.length===2?'20'+c:c;return time?`${y}-${b}-${a}T${time}:00+02:00`:`${y}-${b}-${a}`}
function parseFlowLive(html:string){const t=clean(html);const m=t.match(/Letzter Messwert vom\s*(\d{2}\.\d{2}\.\d{2,4})\s*(\d{2}:\d{2})\s*Uhr:\s*([\d,.]+)\s*m³\/s/i);if(!m)throw new Error('flow_live_parse');return{value:deNum(m[3]),time:`${m[1]} ${m[2]}`}}
function parseTempLive(html:string){const t=clean(html);const start=t.indexOf('Wassertemperatur der letzten 7 Tage');const s=start>=0?t.slice(start):t;const m=s.match(/(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})(?:\s*Uhr)?\s+([0-9]{1,2}(?:[\.,][0-9])?)/);if(!m)throw new Error('temp_live_parse');return{value:deNum(m[3]),time:`${m[1]} ${m[2]}`}}
function parseFlowMonth(html:string){const t=clean(html),out:{date:string,value:number}[]=[];const re=/(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})\s*(?:Uhr)?\s+([\d,.]+)/g;let m;while((m=re.exec(t))){const v=deNum(m[3]);if(Number.isFinite(v))out.push({date:isoDate(m[1],m[2]),value:v})}return dedupe(out).sort((a,b)=>a.date.localeCompare(b.date))}
function parseDaily(html:string){const t=clean(html),out:{date:string,value:number}[]=[];const re=/(\d{2}\.\d{2}\.\d{4})\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)/g;let m;while((m=re.exec(t))){const v=deNum(m[2]);if(Number.isFinite(v))out.push({date:isoDate(m[1]),value:v})}return dedupe(out).sort((a,b)=>a.date.localeCompare(b.date))}
function dedupe<T extends {date:string}>(a:T[]){const m=new Map<string,T>();for(const x of a)m.set(x.date,x);return[...m.values()]}
function downsample<T>(a:T[],n:number){if(a.length<=n)return a;const step=a.length/n;const out:T[]=[];for(let i=0;i<n;i++)out.push(a[Math.min(a.length-1,Math.floor(i*step))]);if(out[out.length-1]!==a[a.length-1])out.push(a[a.length-1]);return out}

export default async function handler(req:VercelRequest,res:VercelResponse){
 if(req.method!=='GET')return res.status(405).end();
 try{
  const year=new Date().getFullYear();
  const prev=year-1;
  const [flowLiveHtml,tempLiveHtml,flowMonthHtml,flowY,flowPrev,tempY,tempPrev,w]=await Promise.all([
   fetch(FLOW_LIVE).then(r=>{if(!r.ok)throw new Error('flow_live_fetch');return r.text()}),
   fetch(TEMP_LIVE).then(r=>{if(!r.ok)throw new Error('temp_live_fetch');return r.text()}),
   fetch(FLOW_MONTH).then(r=>{if(!r.ok)throw new Error('flow_month_fetch');return r.text()}),
   fetch(`${FLOW_YEAR}?beginn=01.01.${year}&ende=31.12.${year}`).then(r=>r.text()),
   fetch(`${FLOW_YEAR}?beginn=01.01.${prev}&ende=31.12.${prev}`).then(r=>r.text()),
   fetch(`${TEMP_YEAR}?beginn=01.01.${year}&ende=31.12.${year}`).then(r=>r.text()),
   fetch(`${TEMP_YEAR}?beginn=01.01.${prev}&ende=31.12.${prev}`).then(r=>r.text()),
   fetch(WEATHER).then(r=>r.json())
  ]);
  const flow=parseFlowLive(flowLiveHtml),temp=parseTempLive(tempLiveHtml);
  let fm=parseFlowMonth(flowMonthHtml);
  const fy=[...parseDaily(flowPrev),...parseDaily(flowY)];
  const ty=[...parseDaily(tempPrev),...parseDaily(tempY)];
  const cutoff=new Date(); cutoff.setDate(cutoff.getDate()-365); const cut=cutoff.toISOString().slice(0,10);
  const f365=fy.filter(x=>x.date>=cut), t365=ty.filter(x=>x.date>=cut);
  const oneMonthCut=new Date();oneMonthCut.setDate(oneMonthCut.getDate()-31);const mc=oneMonthCut.toISOString();
  fm=fm.filter(x=>x.date>=mc);
  if(fm.length<10) fm=f365.slice(-31);
  const tm=t365.slice(-31);
  const target=Date.now()-24*3600*1000; let nearest=fm[0]; for(const p of fm){if(!nearest||Math.abs(new Date(p.date).getTime()-target)<Math.abs(new Date(nearest.date).getTime()-target))nearest=p}
  const change=nearest?flow.value-nearest.value:null;
  const d=w.daily; const forecast=d.time.map((date:string,i:number)=>({date,tMax:d.temperature_2m_max[i],tMin:d.temperature_2m_min[i],precip:d.precipitation_sum[i],wind:d.wind_speed_10m_max[i],code:d.weather_code[i]}));
  const body={updatedAt:new Date().toISOString(),flow:flow.value,flowTime:flow.time,flowChange24h:change,waterTemp:temp.value,waterTime:temp.time,airTemp:w.current.temperature_2m,apparentTemp:w.current.apparent_temperature,precip:w.current.precipitation,weatherCode:w.current.weather_code,forecast,flowMonth:downsample(fm,96),flowYear:downsample(f365,90),tempMonth:tm,tempYear:downsample(t365,90)};
  if(process.env.DATABASE_URL){const sql=neon(process.env.DATABASE_URL);await sql`INSERT INTO dashboard_snapshots (flow,water_temp,air_temp,payload) VALUES (${body.flow},${body.waterTemp},${body.airTemp},${JSON.stringify(body)}::jsonb)`}
  return res.status(200).json(body);
 }catch(e){
  console.error(e);
  if(process.env.DATABASE_URL){try{const sql=neon(process.env.DATABASE_URL);const rows=await sql`SELECT payload FROM dashboard_snapshots ORDER BY captured_at DESC LIMIT 1`;if(rows.length)return res.status(200).json(rows[0].payload)}catch{}}
  return res.status(502).json({error:'dashboard_fetch_failed'});
 }
}