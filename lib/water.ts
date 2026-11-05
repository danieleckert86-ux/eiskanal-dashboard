export type Point = { date: string; value: number };
export type Reading = Point & { measuredAt: string; source: string; sourceUrl: string };
export const FLOW_HND = 'https://www.hnd.bayern.de/pegel/iller_lech/haunstetten-12003500/abfluss';
export const TEMP_NID = 'https://www.nid.bayern.de/wassertemperatur/iller_lech/augsburg-hochablass-12004002/tabelle';
export const FLOW_GKD = 'https://www.gkd.bayern.de/de/fluesse/abfluss/bayern/haunstetten-12003500/messwerte?method=tabellen';
export const TEMP_GKD = 'https://www.gkd.bayern.de/de/fluesse/wassertemperatur/kelheim/augsburg-hochablass-12004002/messwerte?method=tabellen';
export const clean = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;|&#xA0;/gi, ' ').replace(/\s+/g, ' ').trim();
// Convert the station's German local time, including summer time, to an instant.
export function instant(date: string): number {
  const m = date.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return NaN;
  const utc = Date.UTC(+m[3], +m[2]-1, +m[1], +(m[4] ?? 12), +(m[5] ?? 0));
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Berlin', timeZoneName:'shortOffset'}).formatToParts(new Date(utc));
  const offset = parts.find(p => p.type === 'timeZoneName')?.value.match(/GMT([+-])(\d+)(?::(\d+))?/);
  return offset ? utc - (offset[1] === '+' ? 1 : -1) * (+offset[2] * 60 + +(offset[3] ?? 0)) * 60000 : NaN;
}
export function parse(html: string): Point[] {
  if (/Proxy Error|Request Rejected|Bad Gateway/i.test(clean(html).slice(0,1000))) throw new Error('Upstream error page');
  const points = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap(row => {
    const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => clean(c[1]));
    const date = cells[0]?.match(/\d{2}\.\d{2}\.\d{4}(?:\s+\d{2}:\d{2})?/)?.[0];
    const raw = cells[1]?.match(/^-?\d+(?:[.,]\d+)?(?:\s|$)/)?.[0];
    return date && raw ? [{date, value:Number(raw.replace(',','.').trim())}] : [];
  });
  return points.filter(p => Number.isFinite(p.value) && Number.isFinite(instant(p.date))).sort((a,b) => instant(b.date)-instant(a.date));
}
export function parseLive(html: string, kind: 'flow'|'temp', source: string, sourceUrl: string): Reading[] {
  let points = parse(html);
  if (!points.length && kind === 'flow') {
    const m = clean(html).match(/Letzter Messwert vom\s*(\d{2}\.\d{2}\.)(\d{2,4})\s*(\d{2}:\d{2})\s*Uhr:\s*([\d.,]+)\s*m(?:³|&sup3;)\/s/i);
    if (m) points = [{date:`${m[1]}${m[2].length === 2 ? '20'+m[2] : m[2]} ${m[3]}`,value:Number(m[4].replace(',','.'))}];
  }
  return points.filter(p => p.value >= (kind==='flow'?0:-2) && p.value <= (kind==='flow'?10000:40)).map(p => ({...p, measuredAt:new Date(instant(p.date)).toISOString(), source, sourceUrl}));
}
export function ageMinutes(r: Reading, now=Date.now()) { return Math.max(0,Math.floor((now-Date.parse(r.measuredAt))/60000)); }
export function fresh(r: Reading, now=Date.now()) { const age=now-Date.parse(r.measuredAt); return age >= -3600000 && age <= 3*3600000; }
export function newest(a: Reading | undefined, b: Reading | undefined) { return !a ? b : !b ? a : Date.parse(a.measuredAt) >= Date.parse(b.measuredAt) ? a : b; }
export async function resolveLive(kind: 'flow'|'temp', cached: Reading | undefined, loader: (url:string)=>Promise<string>, now=Date.now()) {
  const sources = kind==='flow' ? [[FLOW_HND,'HND Bayern'],[FLOW_GKD,'GKD Bayern']] : [[TEMP_NID,'NID Bayern'],[TEMP_GKD,'GKD Bayern']];
  let best=cached;
  for (const [url,source] of sources) {
    try {
      const readings=parseLive(await loader(url),kind,source,url);
      const candidate=readings[0];
      if (!candidate || Date.parse(candidate.measuredAt)>now+3600000) continue;
      best=newest(best,candidate);
      if (fresh(candidate,now) && best===candidate) {
        const past=readings.find(r => Math.abs(Date.parse(candidate.measuredAt)-Date.parse(r.measuredAt)-86400000)<=30*60000);
        return {reading:candidate, stale:false, delta24h:past ? candidate.value-past.value : null};
      }
    } catch { /* Try a different host; never replace a successful reading with an error. */ }
  }
  return {reading:best,stale:true,delta24h:null};
}
export function metric(result: Awaited<ReturnType<typeof resolveLive>>, now=Date.now()) {
  const r=result.reading;
  return {current:r?.value ?? null, updated:r?.date ?? null, measuredAt:r?.measuredAt ?? null, source:r?.source ?? null, sourceUrl:r?.sourceUrl ?? null, ageMinutes:r?ageMinutes(r,now):null, stale:result.stale || !!r&&!fresh(r,now), delta24h:result.delta24h, month:[],year:[], ...(!r?{error:'Messwert derzeit nicht verfügbar'}:result.stale||!fresh(r,now)?{error:'Abruf gestört oder Messwert veraltet – letzter bekannter Stand'}:{})};
}
