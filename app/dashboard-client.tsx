"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CloudRain, Droplets, ExternalLink, Gauge, RefreshCw, Thermometer, Waves } from "lucide-react";
import { ClothingAdvisor } from "@/components/clothing-advisor";

type RangeKey = "month" | "year";
type ChartPoint = { label: string; value: number; date?: string };
type WaterMetric = { current: number | null; delta24h: number | null; updated: string | null; month: ChartPoint[]; year: ChartPoint[]; error?: string; stale?: boolean; measuredAt?: string | null; source?: string | null; sourceUrl?: string | null; ageMinutes?: number | null };
export type WaterData = { flow: WaterMetric; temp: WaterMetric; source: string; storageAvailable?: boolean };
export type WeatherData = { current: { temperature_2m: number; apparent_temperature: number; precipitation: number; weather_code: number; wind_speed_10m: number }; daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum: number[]; precipitation_probability_max: (number | null)[]; wind_speed_10m_max: number[] } };
type ForecastDay = { date: string; code: number; max: number; min: number; rain: number; rainProbability: number | null; wind: number };
const weatherIcons: Record<number, string> = { 0: "☀", 1: "🌤", 2: "⛅", 3: "☁", 45: "🌫", 48: "🌫", 51: "🌦", 61: "🌧", 63: "🌧", 65: "🌧", 80: "🌦", 81: "🌧", 95: "⛈" };

function StatCard({ icon, label, value, unit, note, accent, stale, sourceUrl }: { icon: React.ReactNode; label: string; value: string; unit: string; note: string; accent: string; stale?: boolean; sourceUrl?: string | null }) {
  return <section className="stat-card"><div className="stat-head"><span className="icon-box" style={{ color: accent }}>{icon}</span><span>{label}</span><span className="live-dot" style={stale ? {color:"#f4c566"} : undefined}>{value === "—" ? "KEINE DATEN" : stale ? "LETZTER STAND" : "LIVE"}</span></div><div className="stat-value"><strong>{value}</strong><span>{unit}</span></div><p>{note}{sourceUrl && <> · <a href={sourceUrl} target="_blank" rel="noreferrer">Quelle öffnen</a></>}</p></section>;
}

function MetricChart({ kind, water }: { kind: "flow" | "temp"; water: WaterData | null }) {
  const [range, setRange] = useState<RangeKey>("month");
  const metric = water?.[kind];
  const data = metric?.[range] ?? [];
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
  return <section className="chart-card"><div className="card-title-row"><div><span className="eyebrow">VERLAUF</span><h2>{kind === "flow" ? "Abfluss" : "Wassertemperatur"}</h2></div><div className="segmented" aria-label="Zeitraum wählen"><button className={range === "month" ? "active" : ""} onClick={() => setRange("month")}>1 Monat</button><button className={range === "year" ? "active" : ""} onClick={() => setRange("year")}>12 Monate</button></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 14, right: 8, left: -24, bottom: 0 }}><defs><linearGradient id={`grad-${kind}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity={.35}/><stop offset="1" stopColor={color} stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false}/><XAxis dataKey="date" ticks={monthTicks} tickFormatter={formatTick} stroke="#71808b" tickLine={false} axisLine={false} interval={range === "year" ? 0 : 5}/><YAxis stroke="#71808b" tickLine={false} axisLine={false}/><Tooltip labelFormatter={(date) => String(date)} contentStyle={{ background: "#12202b", border: "1px solid #2b3b47", borderRadius: 12 }} formatter={(v) => [`${Number(v).toFixed(1)} ${kind === "flow" ? "m³/s" : "°C"}`, range === "year" ? "Wochenmittel" : "Wert"]}/><Area type="monotone" dataKey="value" stroke={color} strokeWidth={3} fill={`url(#grad-${kind})`} dot={false}/></AreaChart></ResponsiveContainer></div><p className="demo-note">{!water ? "Messdaten werden geladen …" : data.length ? `${range === "year" ? "12 Monate · Wochenmittel" : "1 Monat"} · Reale Messwerte · LfU Bayern${metric?.updated ? ` · Stand ${metric.updated}` : ""}` : metric?.error ?? "Für diesen Zeitraum sind keine Messwerte verfügbar."}</p></section>;
}

export default function DashboardClient({ initialWater, initialWeather }: { initialWater: WaterData | null; initialWeather: WeatherData | null }) {
  const [weather, setWeather] = useState<WeatherData | null>(initialWeather);
  const [water, setWater] = useState<WaterData | null>(initialWater);
  const [updated, setUpdated] = useState(new Date());
  const [clock, setClock] = useState(Date.now());
  useEffect(() => { const id=window.setInterval(()=>setClock(Date.now()),60000); return ()=>window.clearInterval(id); }, []);
  const refresh = useCallback(() => {
    // Preserve the last successfully loaded values on temporary network failures.
    // The server already supplies initial values; a failed browser request must not erase them.
    fetch("https://api.open-meteo.com/v1/forecast?latitude=48.348&longitude=10.93&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=Europe%2FBerlin&forecast_days=7", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Wetterdaten nicht verfügbar");
        return await r.json() as WeatherData;
      })
      .then((data) => {
        if (!data?.current || !data?.daily?.time) throw new Error("Ungültige Wetterdaten");
        setWeather(data);
        setUpdated(new Date());
      })
      .catch((error) => console.warn("Wetteraktualisierung fehlgeschlagen; letzte Daten bleiben sichtbar", error));
    fetch("/api/water-data", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("Messdaten nicht verfügbar");
        return await r.json() as WaterData;
      })
      .then((data) => {
        if (!data?.flow || !data?.temp) throw new Error("Ungültige Messdaten");
        setWater(previous => {
          const merge=(kind:"flow"|"temp") => {
            const incoming=data[kind], old=previous?.[kind];
            const selected=incoming.current == null && old?.current != null ? {...old,stale:true,error:incoming.error ?? "Abruf gestört – letzter bekannter Stand"} : incoming;
            return {...selected,month:old?.month ?? incoming.month,year:old?.year ?? incoming.year};
          };
          return {...data,flow:merge("flow"),temp:merge("temp")};
        });
        setUpdated(new Date());
      })
      .catch(() => setWater(previous => previous ? {...previous,flow:{...previous.flow,stale:true,error:"Abruf gestört – letzter bekannter Stand"},temp:{...previous.temp,stale:true,error:"Abruf gestört – letzter bekannter Stand"}} : null));
  }, []);
  useEffect(() => {
    // Server preloading avoids redundant requests during initial browser hydration.
    if (!initialWater || !initialWeather) {
      const initialTimer = window.setTimeout(refresh, 0);
      const interval = window.setInterval(refresh, 5 * 60 * 1000);
      return () => { window.clearTimeout(initialTimer); window.clearInterval(interval); };
    }
    const interval = window.setInterval(refresh, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [refresh, initialWater, initialWeather]);
  useEffect(() => {
    let active=true;
    fetch("/api/water-data?history=1",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{
      if(active && data.history) setWater(previous=>previous ? {...previous,flow:{...previous.flow,...data.history.flow},temp:{...previous.temp,...data.history.temp}} : previous);
    }).catch(()=>{});
    return ()=>{active=false;};
  }, []);
  const withAge=(m:WaterMetric|undefined) => {
    if(!m)return m;
    const age=m.measuredAt ? Math.max(0,Math.floor((clock-Date.parse(m.measuredAt))/60000)) : m.ageMinutes;
    return {...m,ageMinutes:age,stale:m.stale || age != null && age > 180};
  };
  const flow = withAge(water?.flow);
  const temp = withAge(water?.temp);
  const note=(m:WaterMetric|undefined,unit:string)=> {
    if(!m || m.current == null)return m?.error ?? "Messwert nicht verfügbar";
    const age=m.ageMinutes == null ? "" : m.ageMinutes<60 ? `${m.ageMinutes} Min. alt` : `${Math.floor(m.ageMinutes/60)} Std. ${m.ageMinutes%60} Min. alt`;
    return `${m.stale ? "Letzter bekannter Stand · " : ""}${m.updated ?? ""} · ${age} · ${m.source ?? "LfU Bayern"}${m.stale ? " · Aktueller Abruf gestört oder Messwert veraltet" : m.delta24h == null ? "" : ` · ${m.delta24h>=0?"+":""}${m.delta24h.toFixed(1)} ${unit} in 24 h`}`;
  };
  const flowAvailable = flow?.current != null;
  const tempAvailable = temp?.current != null;
  const flowFresh = flowAvailable && !flow?.stale;
  const tempFresh = tempAvailable && !temp?.stale;
  const days = useMemo<ForecastDay[]>(() => weather?.daily.time.map((date, i) => ({ date, code: weather.daily.weather_code[i], max: weather.daily.temperature_2m_max[i], min: weather.daily.temperature_2m_min[i], rain: weather.daily.precipitation_sum[i], rainProbability: weather.daily.precipitation_probability_max?.[i] ?? null, wind: weather.daily.wind_speed_10m_max[i] })) ?? [], [weather]);
  return <main><header className="topbar"><div className="brand"><span className="brand-mark"><Waves size={22}/></span><div><h1>EISKANAL</h1><span>AUGSBURG · LIVE DASHBOARD</span></div></div><div className="header-meta"><span>Zuletzt aktualisiert: {updated.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span><button onClick={refresh} aria-label="Daten aktualisieren"><RefreshCw size={18}/><span>Aktualisieren</span></button></div></header><div className="dashboard">
    <section className="decision-card"><div className="status-orb"><Waves size={34}/></div><div><span className="eyebrow">PADDELCHECK</span><h2>{flowFresh ? (flow!.current! >= 50 ? "Abfluss über 50 m³/s" : "Abfluss unter 50 m³/s") : flowAvailable ? "Abfluss: letzter bekannter Stand" : water ? "Abfluss nicht verfügbar" : "Bedingungen werden geladen"}</h2><p>{flowFresh ? `Aktuell meldet Haunstetten ${flow!.current!.toFixed(1).replace(".", ",")} m³/s. Ob die Wettkampfstrecke tatsächlich geflutet und freigegeben ist, erkennst du direkt auf der Webcam.` : flowAvailable ? "Der letzte Messwert bleibt unten sichtbar. Für die aktuelle Einschätzung fehlen bestätigte Messdaten; bitte Webcam und Streckenfreigabe prüfen." : water ? "Der Abflusswert ist momentan nicht abrufbar. Die anderen Daten bleiben nutzbar." : "Die aktuellen Messwerte des LfU Bayern werden abgerufen."}</p></div></section>
    <div className="stat-grid"><StatCard icon={<Gauge size={22}/>} label="ABFLUSS · HAUNSTETTEN" value={flowAvailable ? flow!.current!.toFixed(1).replace(".", ",") : "—"} unit="m³/s" note={note(flow,"m³/s")} stale={flow?.stale} sourceUrl={flow?.sourceUrl} accent="#31d6d0"/><StatCard icon={<Thermometer size={22}/>} label="WASSERTEMPERATUR · HOCHABLASS" value={tempAvailable ? temp!.current!.toFixed(1).replace(".", ",") : "—"} unit="°C" note={note(temp,"°C")} stale={temp?.stale} sourceUrl={temp?.sourceUrl} accent="#f4c566"/><StatCard icon={<CloudRain size={22}/>} label="WETTER JETZT" value={weather ? `${Math.round(weather.current.temperature_2m)}` : "—"} unit="°C" note={weather ? `${weather.current.precipitation} mm · Regenchance heute max. ${weather.daily.precipitation_probability_max?.[0] == null ? "—" : `${Math.round(weather.daily.precipitation_probability_max[0])} %`} · gefühlt ${Math.round(weather.current.apparent_temperature)} °C` : "Wetterdaten werden geladen"} accent="#8eb6ff"/>
    {tempFresh && weather ? <ClothingAdvisor liveWater={temp!.current!} liveAir={weather.current.temperature_2m} liveWind={weather.current.wind_speed_10m} weatherCode={weather.current.weather_code}/> : <section className="advisor-card advisor-loading">{!water || !weather ? "Bekleidungsberater lädt die aktuellen Bedingungen …" : tempAvailable ? "Bekleidungsberatung pausiert: Wassertemperatur ist nicht aktuell bestätigt." : "Bekleidungsberatung derzeit nicht verfügbar: Wassertemperatur fehlt."}</section>}
    </div>
    {water?.storageAvailable === false && <p role="status" className="source-line">Der dauerhafte Messwertspeicher ist derzeit nicht erreichbar.</p>}
    <div className="main-grid"><MetricChart kind="flow" water={water}/><MetricChart kind="temp" water={water}/></div>
    <div className="lower-grid"><section className="webcam-card"><div className="card-title-row"><div><span className="eyebrow">AKTUELLES BILD</span><h2>Webcam Olympiastrecke</h2></div><span className="cam-badge">Update alle 2 Stunden</span></div><a className="webcam-frame webcam-live" href="https://www.eiskanal-augsburg.de/eiskanal-infos/eiskanal-webcam/" target="_blank" aria-label="Webcam in der Originalansicht öffnen"><img src={`/api/webcam?t=${updated.getTime()}`} alt="Aktuelles Webcam-Bild der Olympiastrecke am Augsburger Eiskanal"/><span className="webcam-link">Originalansicht <ExternalLink size={14}/></span></a><p className="source-line">Aus Datenschutzgründen aktualisiert der Betreiber das Bild alle zwei Stunden.</p></section>
    <section className="weather-card"><div className="card-title-row"><div><span className="eyebrow">AUGSBURG · 7 TAGE</span><h2>Wetterausblick</h2></div><Droplets size={22}/></div><div className="forecast-list">{days.length ? days.map((d, i) => <div className="forecast-row" key={d.date}><span className="day">{i === 0 ? "Heute" : new Date(d.date).toLocaleDateString("de-DE", { weekday: "short" })}</span><span className="weather-icon">{weatherIcons[d.code] ?? "☁"}</span><span className="temps"><strong>{Math.round(d.max)}°</strong> {Math.round(d.min)}°</span><span className="rain"><span>{Number(d.rain).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mm</span><span className="rain-probability" aria-label={d.rainProbability == null ? "Regenwahrscheinlichkeit nicht verfügbar" : `Maximale Regenwahrscheinlichkeit ${Math.round(d.rainProbability)} Prozent`}>{d.rainProbability == null ? "—" : `${Math.round(d.rainProbability)} %`}</span></span><span className="wind">{Math.round(d.wind)} km/h</span></div>) : <div className="weather-loading">Wetterdaten werden geladen …</div>}</div><p className="source-line">Tageswerte · Regenmenge und maximale Regenwahrscheinlichkeit · maximale Windgeschwindigkeit · Open-Meteo</p></section></div>
    <footer><span>Messdaten: Bayerisches Landesamt für Umwelt / HND / NID Bayern</span><span>Die Einschätzung ersetzt keine Prüfung der Streckenfreigabe vor Ort.</span></footer>
  </div></main>;
}
