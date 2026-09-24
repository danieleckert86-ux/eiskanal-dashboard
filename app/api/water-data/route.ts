import { NextResponse } from "next/server";

const BASE = "https://www.gkd.bayern.de/de/fluesse";
type Point = { date: string; value: number };
const DAY = 86_400_000;
const clean = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").trim();
function parse(html: string): Point[] {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap((row) => {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => clean(cell[1]));
    const date = cells[0]?.match(/\d{2}\.\d{2}\.\d{4}(?:\s+\d{2}:\d{2})?/)?.[0];
    const raw = cells[1]?.match(/-?\d+(?:[.,]\d+)?/)?.[0];
    return date && raw ? [{ date, value: Number(raw.replace(",", ".")) }] : [];
  });
}
const formatted = (p: Point) => ({ label: p.date.slice(0, 6), value: p.value, date: p.date });
function sample(points: Point[], count = 32) {
  const list = [...points].reverse();
  if (list.length <= count) return list.map(formatted);
  return Array.from({ length: count }, (_, i) => list[Math.round(i * (list.length - 1) / (count - 1))]).map(formatted);
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
async function load(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Eiskanal-Dashboard/1.0" }, cache: "no-store" });
  if (!r.ok) throw new Error(String(r.status));
  return parse(await r.text());
}
export async function GET() {
  try {
    const year = new Date().getUTCFullYear();
    const previousYear = `?beginn=01.01.${year - 1}&ende=31.12.${year - 1}`;
    const [fm, fy, fyPrevious, tm, ty, tyPrevious] = await Promise.all([
      load(`${BASE}/abfluss/bayern/haunstetten-12003500/monatswerte/tabelle`),
      load(`${BASE}/abfluss/bayern/haunstetten-12003500/jahreswerte/tabelle`),
      load(`${BASE}/abfluss/bayern/haunstetten-12003500/jahreswerte/tabelle${previousYear}`),
      load(`${BASE}/wassertemperatur/bayern/augsburg-hochablass-12004002/monatswerte/tabelle`),
      load(`${BASE}/wassertemperatur/bayern/augsburg-hochablass-12004002/jahreswerte/tabelle`),
      load(`${BASE}/wassertemperatur/bayern/augsburg-hochablass-12004002/jahreswerte/tabelle${previousYear}`),
    ]);
    if (!fm.length || !tm.length) throw new Error("empty");
    const f24 = fm[Math.min(96, fm.length - 1)]?.value ?? fm[0].value;
    const t24 = tm[Math.min(96, tm.length - 1)]?.value ?? tm[0].value;
    return NextResponse.json({
      flow: { current: fm[0].value, delta24h: fm[0].value - f24, updated: fm[0].date, month: sample(fm), year: weekly([...fyPrevious, ...fy]) },
      temp: { current: tm[0].value, delta24h: tm[0].value - t24, updated: tm[0].date, month: sample(tm), year: weekly([...tyPrevious, ...ty]) },
      source: "Gewässerkundlicher Dienst Bayern (LfU)",
    }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
  } catch {
    return NextResponse.json({ error: "Messdaten derzeit nicht verfügbar" }, { status: 502 });
  }
}
