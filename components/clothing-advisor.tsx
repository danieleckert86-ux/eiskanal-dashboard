"use client";

import { useMemo, useState } from "react";
import { CloudSun, RefreshCw, Shirt, Sun } from "lucide-react";
import { calculateClothing, type Personal, type Sun as SunValue } from "@/lib/clothing-advisor";

type Props = { liveWater?: number; liveAir?: number; liveWind?: number; weatherCode?: number };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const sunFromCode = (code?: number): SunValue => code === 0 ? "SUNNY" : code != null && code <= 2 ? "PARTLY" : "CLOUDY";

function Slider({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (value: number) => void }) {
  return <label className="advisor-control"><span><strong>{label}</strong><output>{value.toLocaleString("de-DE")} {unit}</output></span><input type="range" min={min} max={max} step={1} value={value} onChange={(event) => onChange(Number(event.target.value))}/></label>;
}

export function ClothingAdvisor({ liveWater, liveAir, liveWind, weatherCode }: Props) {
  const [water, setWater] = useState(() => Math.round(clamp(liveWater ?? 15, 5, 22)));
  const [air, setAir] = useState(() => Math.round(clamp(liveAir ?? 15, -10, 35)));
  const [wind, setWind] = useState(() => Math.round(clamp(liveWind ?? 5, 0, 60)));
  const [sun, setSun] = useState<SunValue>(() => sunFromCode(weatherCode));
  const [personal, setPersonal] = useState<Personal>("NORMAL");
  const applyLiveValues = () => {
    if (liveWater != null) setWater(Math.round(clamp(liveWater, 5, 22)));
    if (liveAir != null) setAir(Math.round(clamp(liveAir, -10, 35)));
    if (liveWind != null) setWind(Math.round(clamp(liveWind, 0, 60)));
    setSun(sunFromCode(weatherCode));
  };
  const result = useMemo(() => calculateClothing({ water, air, wind, sun, personal }), [water, air, wind, sun, personal]);

  return <section className="advisor-card">
    <div className="advisor-heading"><h2>Bekleidung fürs Training</h2><button className="live-values" onClick={applyLiveValues} disabled={liveWater == null || liveAir == null || liveWind == null}><RefreshCw size={15}/>Livewerte</button></div>
    <div className="advisor-layout">
      <div className="advisor-inputs">
        <Slider label="Wassertemperatur" value={water} min={5} max={22} unit="°C" onChange={setWater}/>
        <Slider label="Lufttemperatur" value={air} min={-10} max={35} unit="°C" onChange={setAir}/>
        <Slider label="Windgeschwindigkeit" value={wind} min={0} max={60} unit="km/h" onChange={setWind}/>
        <fieldset className="sun-options"><legend>Sonnigkeit</legend><div>
          <button aria-pressed={sun === "CLOUDY"} className={sun === "CLOUDY" ? "active" : ""} onClick={() => setSun("CLOUDY")}><CloudSun size={16}/>Bewölkt</button>
          <button aria-pressed={sun === "PARTLY"} className={sun === "PARTLY" ? "active" : ""} onClick={() => setSun("PARTLY")}><CloudSun size={16}/>Teilweise sonnig</button>
          <button aria-pressed={sun === "SUNNY"} className={sun === "SUNNY" ? "active" : ""} onClick={() => setSun("SUNNY")}><Sun size={16}/>Direkte Sonne</button>
        </div></fieldset>
        <fieldset className="personal-options"><legend>Wärmeempfinden</legend><div>
          <button type="button" aria-pressed={personal === "COLD_SENSITIVE"} className={personal === "COLD_SENSITIVE" ? "active" : ""} onClick={() => setPersonal("COLD_SENSITIVE")}>Friere schnell</button>
          <button type="button" aria-pressed={personal === "NORMAL"} className={personal === "NORMAL" ? "active" : ""} onClick={() => setPersonal("NORMAL")}>Normal</button>
          <button type="button" aria-pressed={personal === "RUNS_WARM"} className={personal === "RUNS_WARM" ? "active" : ""} onClick={() => setPersonal("RUNS_WARM")}>Mir wird warm</button>
        </div></fieldset>
      </div>
      <div className="advisor-result">
        <div className={`heat-stage stage-${result.stage.toLowerCase().replace("_", "-")}`}><Shirt size={22}/><span>Deine Wärmestufe</span><strong>{result.stageLabel}</strong></div>
        <div className="gear-block"><h3>Empfehlung</h3>{result.recommended.length ? <div className="gear-chips">{result.recommended.map((item) => <span key={item}>{item}</span>)}</div> : <p className="gear-empty">Keine zusätzliche Oberbekleidung.</p>}</div>
        {result.optional.length > 0 && <div className="gear-block optional"><h3>Optional</h3><div className="gear-chips">{result.optional.map((item) => <span key={item}>{item}</span>)}</div></div>}
        <details className="calculation"><summary>Details & Sicherheit</summary>
          <p className="advisor-explanation">{result.explanation}</p>
          <div className="always-worn"><strong>Immer dabei</strong><span>{result.always.join(" · ")}</span></div>
          <dl><div><dt>Grundstufe</dt><dd>{result.baseLabel}</dd></div><div><dt>Wind</dt><dd>{result.windText}</dd></div><div><dt>Sonne</dt><dd>{result.sunText}</dd></div><div><dt>Wärmeempfinden</dt><dd>{result.personalText}</dd></div><div><dt>Kaltwassergrenze</dt><dd>{result.minimumText}</dd></div><div><dt>Haube</dt><dd>{result.hood === "none" ? "nicht erforderlich" : result.hood === "optional" ? "optional" : "empfohlen"}</dd></div><div><dt>Handschuhe</dt><dd>{result.gloves === "none" ? "nicht erforderlich" : result.gloves === "optional" ? "optional" : "empfohlen"}</dd></div></dl>
          {water < 15 && <p className="safety-note">Kaltes Wasser kann Atmung und Bewegungsfähigkeit nach einer Kenterung beeinträchtigen. Die Empfehlung ist für kurze Schwimmeinlagen ausgelegt.</p>}
          {water < 10 && <p className="safety-note stronger">LongJohn und Paddeljacke ersetzen bei längerer Schwimmeinlage keinen Trockenanzug.</p>}
        </details>
      </div>
    </div>
  </section>;
}
