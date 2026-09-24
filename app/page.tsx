"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CloudRain, Droplets, ExternalLink, Gauge, RefreshCw, Thermometer, Waves } from "lucide-react";
import { ClothingAdvisor } from "@/components/clothing-advisor";

type RangeKey = "month" | "year";
type ChartPoint = { label: string; value: number; date?: string };
type WaterData = { flow: { current: number; delta24h: number; updated: string; month: ChartPoint[]; year: ChartPoint[] }; temp: { current: number; delta24h: number; updated: string; month: ChartPoint[]; year: ChartPoint[] }; source: string };
type WeatherData = { current: { temperature_2m: number; apparent_temperature: number; precipitation: number; weather_code: number; wind_speed_10m: number }; daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum: number[]; precipitation_probability_max: (number | null)[]; wind_speed_10m_max: number[] } };
type ForecastDay = { date: string; code: number; max: number; min: number; rain: number; rainProbability: number | null; wind: number };
const weatherIcons: Record<number, string> = { 0: "☀", 1: "🌤", 2: "⛅", 3: "☁", 45: "🌫", 48: "🌫", 51: "🌦", 61: "🌧", 63: "🌧", 65: "🌧", 80: "🌦", 81: "🌧", 95: "⛈" };

function StatCard({ icon, label, value, unit, note, accent }: { icon: React.ReactNode; label: string; value: string; unit: string; note: string; accent: string }) {
  return <section className="stat-card"><div className="stat-head"><span className="icon-box" style={{ color: accent }}>{icon}</span><span>{label}</span><span className="live-dot">LIVE</span></div><div className="stat-value"><strong>{value}</strong><span>{unit}</span></div><p>{note}</p></section>;
}

function MetricChart({ kind, water }: { kind: "flow" | "temp"; water: WaterData | null }) {
  const [range, setRange] = useState<RangeKey>("month");
  const data = water ? water[kind][range] : [];
  const color = kind === "flow" ? "#31d6d0" : "#f4c566";
  const monthTicks = range === "year" ? data.reduce<string[]>((ticks, point) => {
    if (!point.date) return ticks;
    const monthYear = point.date.slice(3, 10);
    const previous = ticks.at(-1)?.slice(3, 10);
    if (monthYear !== previous) ticks.push(point.date);
    return ticks;
  }, []) : undefined;
  const formatTick = (date: string) => {
    if (range === "month") return date?.slice(0, 6) ?? "";
    const initials = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
    return initials[Number(date?.slice(3, 5)) - 1] ?? "";
  };
  return <section className="chart-card"><div className="card-title-row"><div><span className="eyebrow">VERLAUF</span><h2>{kind === "flow" ? "Abfluss" : "Wassertemperatur"}</h2></div><div className="segmented" aria-label="Zeitraum wählen"><button className={range === "month" ? "active" : ""} onClick={() => setRange("month")}>1 Monat</button><button className={range === "year" ? "active" : ""} onClick={() => setRange("year")}>12 Monate</button></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 14, right: 8, left: -24, bottom: 0 }}><defs><linearGradient id={`grad-${kind}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={.35}/><stop offset="1" stopColor={color} stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false}/><XAxis dataKey="date" ticks={monthTicks} tickFormatter={formatTick} stroke="#71808b" tickLine={false} axisLine={false} interval={range === "year" ? 0 : 5}/><YAxis stroke="#71808b" tickLine={false} axisLine={false}/><Tooltip labelFormatter={(date) => String(date)} contentStyle={{ background: "#12202b", border: "1px solid #2b3b47", borderRadius: 12 }} formatter={(v) => [`${Number(v).toFixed(1)} ${kind === "flow" ? "m³/s" : "°C"}`, range === "year" ? "Wochenmittel" : "Wert"]}/><Area type="monotone" dataKey="value" stroke={color} strokeWidth={3} fill={`url(#grad-${kind})`} dot={false}/></AreaChart></ResponsiveContainer></div><p className="demo-note">{water ? `${range === "year" ? "12 Monate · Wochenmittel" : "1 Monat"} · Reale Messwerte · LfU Bayern · Stand ${water[kind].updated}` : "Messdaten werden geladen …"}</p></section>;
}

export default function Home() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [water, setWater] = useState<WaterData | null>(null);
  const [updated, setUpdated] = useState(new Date());
  const refresh = useCallback(() => {
    setUpdated(new Date());
    fetch("https://api.open-meteo.com/v1/forecast?latitude=48.348&longitude=10.93&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=Europe%2FBerlin&forecast_days=7").then(async (r) => await r.json() as WeatherData).then(setWeather).catch(() => setWeather(null));
    fetch("/api/water-data").then(async (r) => {
      if (!r.ok) throw new Error("Messdaten nicht verfügbar");
      return await r.json() as WaterData;
    }).then(setWater).catch(() => setWater(null));
  }, []);
  useEffect(() => { const timer = window.setTimeout(refresh, 0); return () => window.clearTimeout(timer); }, [refresh]);
  const days = useMemo<ForecastDay[]>(() => weather?.daily.time.map((date, i) => ({ date, code: weather.daily.weather_code[i], max: weather.daily.temperature_2m_max[i], min: weather.daily.temperature_2m_min[i], rain: weather.daily.precipitation_sum[i], rainProbability: weather.daily.precipitation_probability_max?.[i] ?? null, wind: weather.daily.wind_speed_10m_max[i] })) ?? [], [weather]);
  return <main><header className="topbar"><div className="brand"><span className="brand-mark"><Waves size={22}/></span><div><h1>EISKANAL</h1><span>AUGSBURG · LIVE DASHBOARD</span></div></div><div className="header-meta"><span>Zuletzt aktualisiert: {updated.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span><button onClick={refresh} aria-label="Daten aktualisieren"><RefreshCw size={18}/><span>Aktualisieren</span></button></div></header><div className="dashboard">
    <section className="decision-card"><div className="status-orb"><Waves size={34}/></div><div><span className="eyebrow">PADDELCHECK</span><h2>{water ? (water.flow.current >= 50 ? "Abfluss über 50 m³/s" : "Abfluss unter 50 m³/s") : "Bedingungen werden geladen"}</h2><p>{water ? `Aktuell meldet Haunstetten ${water.flow.current.toFixed(1).replace(".", ",")} m³/s. Ob die Wettkampfstrecke tatsächlich geflutet und freigegeben ist, erkennst du direkt auf der Webcam.` : "Die aktuellen Messwerte des LfU Bayern werden abgerufen."}</p></div></section>
    <div className="stat-grid"><StatCard icon={<Gauge size={22}/>} label="ABFLUSS · HAUNSTETTEN" value={water ? water.flow.current.toFixed(1).replace(".", ",") : "—"} unit="m³/s" note={water ? `${water.flow.delta24h >= 0 ? "+" : ""}${water.flow.delta24h.toFixed(1).replace(".", ",")} m³/s in 24 h · ${water.flow.updated}` : "LfU-Messdaten werden geladen"} accent="#31d6d0"/><StatCard icon={<Thermometer size={22}/>} label="WASSERTEMPERATUR · HOCHABLASS" value={water ? water.temp.current.toFixed(1).replace(".", ",") : "—"} unit="°C" note={water ? `${water.temp.delta24h >= 0 ? "+" : ""}${water.temp.delta24h.toFixed(1).replace(".", ",")} °C in 24 h · ${water.temp.updated}` : "LfU-Messdaten werden geladen"} accent="#f4c566"/><StatCard icon={<CloudRain size={22}/>} label="WETTER JETZT" value={weather ? `${Math.round(weather.current.temperature_2m)}` : "—"} unit="°C" note={weather ? `${weather.current.precipitation} mm · gefühlt ${Math.round(weather.current.apparent_temperature)} °C` : "Wetterdaten werden geladen"} accent="#8eb6ff"/></div>
    {water && weather ? <ClothingAdvisor liveWater={water.temp.current} liveAir={weather.current.temperature_2m} liveWind={weather.current.wind_speed_10m} weatherCode={weather.current.weather_code}/> : <section className="advisor-card advisor-loading">Bekleidungsberater lädt die aktuellen Bedingungen …</section>}
    <div className="main-grid"><MetricChart kind="flow" water={water}/><MetricChart kind="temp" water={water}/></div>
    <div className="lower-grid"><section className="webcam-card"><div className="card-title-row"><div><span className="eyebrow">AKTUELLES BILD</span><h2>Webcam Olympiastrecke</h2></div><span className="cam-badge">Update alle 2 Stunden</span></div><a className="webcam-frame webcam-live" href="https://www.eiskanal-augsburg.de/eiskanal-infos/eiskanal-webcam/" target="_blank" aria-label="Webcam in der Originalansicht öffnen"><img src={`/api/webcam?t=${updated.getTime()}`} alt="Aktuelles Webcam-Bild der Olympiastrecke am Augsburger Eiskanal"/><span className="webcam-link">Originalansicht <ExternalLink size={14}/></span></a><p className="source-line">Aus Datenschutzgründen aktualisiert der Betreiber das Bild alle zwei Stunden.</p></section>
    <section className="weather-card"><div className="card-title-row"><div><span className="eyebrow">AUGSBURG · 7 TAGE</span><h2>Wetterausblick</h2></div><Droplets size={22}/></div><div className="forecast-list">{days.length ? days.map((d, i) => <div className="forecast-row" key={d.date}><span className="day">{i === 0 ? "Heute" : new Date(d.date).toLocaleDateString("de-DE", { weekday: "short" })}</span><span className="weather-icon">{weatherIcons[d.code] ?? "☁"}</span><span className="temps"><strong>{Math.round(d.max)}°</strong> {Math.round(d.min)}°</span><span className="rain"><span>{Number(d.rain).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mm</span><span className="rain-probability" aria-label={d.rainProbability == null ? "Regenwahrscheinlichkeit nicht verfügbar" : `Maximale Regenwahrscheinlichkeit ${Math.round(d.rainProbability)} Prozent`}>{d.rainProbability == null ? "—" : `${Math.round(d.rainProbability)} %`}</span></span><span className="wind">{Math.round(d.wind)} km/h</span></div>) : <div className="weather-loading">Wetterdaten werden geladen …</div>}</div><p className="source-line">Tageswerte · Regenmenge und maximale Regenwahrscheinlichkeit · maximale Windgeschwindigkeit · Open-Meteo</p></section></div>
    <footer><span>Messdaten: Bayerisches Landesamt für Umwelt / HND Bayern</span><span>Die Einschätzung ersetzt keine Prüfung der Streckenfreigabe vor Ort.</span></footer>
  </div></main>;
}
