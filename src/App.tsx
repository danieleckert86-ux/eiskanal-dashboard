import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CloudRain, Droplets, ExternalLink, Gauge, RefreshCw, Shirt,
  Thermometer, Waves, Wind
} from 'lucide-react';

type Point={date:string;value:number};
type Forecast={date:string;tMax:number;tMin:number;precip:number;wind:number;code:number};
type Data={
  updatedAt:string;flow:number;flowTime:string;flowChange24h:number|null;
  waterTemp:number;waterTime:string;airTemp:number;apparentTemp:number;precip:number;
  weatherCode:number;forecast:Forecast[];flowMonth:Point[];flowYear:Point[];
  tempMonth:Point[];tempYear:Point[];
};

const fmt=(n:number,d=1)=>new Intl.NumberFormat('de-DE',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const parsePointDate=(s:string)=>new Date(s.length===10?s+'T12:00:00':s);
const shortDate=(s:string)=>parsePointDate(s).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});
const fullPointDate=(s:string)=>parsePointDate(s).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:s.length===10?undefined:'2-digit',minute:s.length===10?undefined:'2-digit'});
const day=(s:string)=>new Date(s+'T12:00:00').toLocaleDateString('de-DE',{weekday:'short'});
const icon=(c:number)=>c===0?'☀️':c<=3?'⛅':c<=48?'☁️':c<=67?'🌧️':'🌦️';

function outfit(w:number,a:number){
  if(w>=20&&a>=20)return{level:'Warm',items:'Neoprenshirt kurzarm + Neoprenschuhe'};
  if(w>=18&&a>=15)return{level:'Mild',items:'Neoprenshirt langarm + Neoprenschuhe'};
  if(w>=16&&a>=10)return{level:'Kühl',items:'Neoprenshirt langarm + Paddeljacke + Neoprenschuhe'};
  if(w>=14)return{level:'Kalt',items:'Long John + Neoprenshirt + Paddeljacke + Neoprenschuhe'};
  return{level:'Sehr kalt',items:'Long John + Neoprenshirt langarm + Paddeljacke + Neoprenschuhe'};
}

function paddleStatus(flow:number){
  if(flow>=50)return{
    label:'Abfluss ab 50 m³/s',
    text:`Aktuell meldet Haunstetten ${fmt(flow)} m³/s. Ob die Wettkampfstrecke tatsächlich geflutet und freigegeben ist, erkennst du direkt auf der Webcam.`
  };
  return{
    label:'Abfluss unter 50 m³/s',
    text:`Aktuell meldet Haunstetten ${fmt(flow)} m³/s. Ob die Wettkampfstrecke tatsächlich geflutet und freigegeben ist, erkennst du direkt auf der Webcam.`
  };
}

function Chart({
  title,points,unit,color,range,onRange,stand
}:{
  title:string;points:Point[];unit:string;color:'cyan'|'amber';
  range:'month'|'year';onRange:(r:'month'|'year')=>void;stand:string
}){
  const wrapRef=useRef<HTMLDivElement>(null);
  const [hover,setHover]=useState<number|null>(null);
  if(!points.length)return <article className="chartCard"><div className="empty">Messdaten werden geladen …</div></article>;

  const p=points;
  const vals=p.map(x=>x.value);
  let min=Math.min(...vals),max=Math.max(...vals);
  if(title==='Abfluss'){min=Math.min(0,Math.floor(min/10)*10);max=Math.ceil(Math.max(max,40)/10)*10;}
  else {min=Math.min(0,Math.floor(min/6)*6);max=Math.ceil(Math.max(max,24)/6)*6;}
  const span=Math.max(1,max-min);
  const px=(i:number)=>5+(i/(p.length-1||1))*93;
  const py=(v:number)=>91-((v-min)/span)*76;
  const line=p.map((x,i)=>`${px(i)},${py(x.value)}`).join(' ');
  const area=`5,91 ${line} 98,91`;
  const yticks=Array.from({length:5},(_,i)=>max-((max-min)/4)*i);
  const xtickIdx=Array.from({length:6},(_,i)=>Math.min(p.length-1,Math.round((p.length-1)*i/5)));
  const hi=hover==null?null:p[hover];

  function move(e:React.MouseEvent<HTMLDivElement>){
    const rect=e.currentTarget.getBoundingClientRect();
    const ratio=Math.min(1,Math.max(0,(e.clientX-rect.left)/rect.width));
    setHover(Math.round(ratio*(p.length-1)));
  }

  return <article className="chartCard">
    <div className="chartHeader">
      <div><span>VERLAUF</span><h2>{title}</h2></div>
      <div className="rangeToggle">
        <button className={range==='month'?'active':''} onClick={()=>onRange('month')}>1 Monat</button>
        <button className={range==='year'?'active':''} onClick={()=>onRange('year')}>12 Monate</button>
      </div>
    </div>
    <div className="plot" ref={wrapRef} onMouseMove={move} onMouseLeave={()=>setHover(null)}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={title}>
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className={`stop ${color}`}/>
            <stop offset="100%" className="stop end"/>
          </linearGradient>
        </defs>
        {yticks.map((v,i)=>{
          const y=15+i*19;
          return <g key={i}>
            <line x1="5" x2="98" y1={y} y2={y} className="gridline"/>
            <text x="1.2" y={y+1.5} className="axis">{fmt(v,0)}</text>
          </g>
        })}
        <polygon points={area} fill={`url(#grad-${color})`} className="area"/>
        <polyline points={line} className={`chartLine ${color}`}/>
        {hover!=null&&<>
          <line x1={px(hover)} x2={px(hover)} y1="15" y2="91" className="hoverLine"/>
          <circle cx={px(hover)} cy={py(p[hover].value)} r="1.6" className={`hoverDot ${color}`}/>
        </>}
      </svg>
      <div className="xTicks">
        {xtickIdx.map((idx,i)=><span key={i} style={{left:`${(i/5)*100}%`,transform:i===0?'none':i===5?'translateX(-100%)':'translateX(-50%)'}}>{shortDate(p[idx].date)}</span>)}
      </div>
      {hi&&<div className="tooltip" style={{left:`${Math.min(78,Math.max(8,px(hover!)-5))}%`}}>
        <b>{fullPointDate(hi.date)}</b>
        <span>Wert : <strong>{fmt(hi.value)} {unit}</strong></span>
      </div>}
    </div>
    <div className="chartFoot">{range==='month'?'1 Monat':'12 Monate'} · Reale Messwerte · LfU Bayern · Stand {stand}</div>
  </article>
}

export default function App(){
  const[data,setData]=useState<Data|null>(null);
  const[loading,setLoading]=useState(true);
  const[err,setErr]=useState('');
  const[flowRange,setFlowRange]=useState<'month'|'year'>('month');
  const[tempRange,setTempRange]=useState<'month'|'year'>('month');

  async function load(){
    setLoading(true);setErr('');
    try{
      const r=await fetch('/api/dashboard');
      if(!r.ok)throw new Error();
      setData(await r.json());
    }catch{
      setErr('Live-Daten konnten nicht geladen werden.');
    }finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[]);

  const paddle=useMemo(()=>data?paddleStatus(data.flow):null,[data]);
  const dress=useMemo(()=>data?outfit(data.waterTemp,data.airTemp):null,[data]);
  const tempChange=useMemo(()=>{
    if(!data||data.tempMonth.length<2)return null;
    const a=data.tempMonth[data.tempMonth.length-1],b=data.tempMonth[data.tempMonth.length-2];
    return a.value-b.value;
  },[data]);

  const updated=data?new Date(data.updatedAt).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}):'—';
  const flowStand=data?.flowTime||'—';
  const tempStand=data?.waterTime||'—';

  return <div className="appShell">
    <header className="siteHeader">
      <div className="brand">
        <div className="brandIcon"><Waves size={30}/></div>
        <div><div className="brandTitle">EISKANAL</div><div className="brandSub">AUGSBURG · LIVE DASHBOARD</div></div>
      </div>
      <div className="headerActions">
        <span>Zuletzt aktualisiert: {updated}</span>
        <button onClick={()=>void load()} disabled={loading}><RefreshCw size={22} className={loading?'spin':''}/>{loading?'Aktualisiere…':'Aktualisieren'}</button>
      </div>
    </header>

    <main className="content">
      {err&&<div className="error">{err}</div>}

      <section className="paddleCard">
        <div className="paddleIcon"><Waves size={46}/></div>
        <div>
          <span>PADDELCHECK</span>
          <h2>{paddle?.label||'Bedingungen werden geladen'}</h2>
          <p>{paddle?.text||'Die aktuellen Messwerte des LfU Bayern werden abgerufen.'}</p>
        </div>
      </section>

      <section className="metricGrid">
        <article className="metricCard">
          <div className="metricTop"><div className="metricLabel cyan"><Gauge size={28}/><span>ABFLUSS · HAUNSTETTEN</span></div><em>LIVE</em></div>
          <div className="metricValue">{data?fmt(data.flow):'—'} <small>m³/s</small></div>
          <p>{data?.flowChange24h==null?'—':`${data.flowChange24h>=0?'+':''}${fmt(data.flowChange24h)} m³/s in 24 h`} · {flowStand}</p>
        </article>

        <article className="metricCard">
          <div className="metricTop"><div className="metricLabel amber"><Thermometer size={28}/><span>WASSERTEMPERATUR ·<br/>HOCHABLASS</span></div><em>LIVE</em></div>
          <div className="metricValue">{data?fmt(data.waterTemp):'—'} <small>°C</small></div>
          <p>{tempChange==null?'—':`${tempChange>=0?'+':''}${fmt(tempChange)} °C in 24 h`} · {tempStand}</p>
        </article>

        <article className="metricCard">
          <div className="metricTop"><div className="metricLabel blue"><CloudRain size={28}/><span>WETTER JETZT</span></div><em>LIVE</em></div>
          <div className="metricValue">{data?Math.round(data.airTemp):'—'} <small>°C</small></div>
          <p>{data?`${fmt(data.precip)} mm · gefühlt ${Math.round(data.apparentTemp)} °C`:'—'}</p>
        </article>

        <article className="metricCard">
          <div className="metricTop"><div className="metricLabel violet"><Shirt size={28}/><span>BEKLEIDUNGSEMPFEHLUNG</span></div><em>LIVE</em></div>
          <div className="metricValue word">{dress?.level||'—'}</div>
          <p>{dress?.items||'Empfehlung wird geladen'}</p>
        </article>
      </section>

      <section className="chartGrid">
        <Chart title="Abfluss" points={data?(flowRange==='month'?data.flowMonth:data.flowYear):[]} unit="m³/s" color="cyan" range={flowRange} onRange={setFlowRange} stand={flowStand}/>
        <Chart title="Wassertemperatur" points={data?(tempRange==='month'?data.tempMonth:data.tempYear):[]} unit="°C" color="amber" range={tempRange} onRange={setTempRange} stand={tempStand}/>
      </section>

      <section className="bottomGrid">
        <article className="webcamCard">
          <div className="sectionHead">
            <div><span>AKTUELLES BILD</span><h2>Webcam Olympiastrecke</h2></div>
            <div className="updatePill">Update alle 2 Stunden</div>
          </div>
          <div className="webcamFrame">
            <img src={`/api/webcam?t=${Math.floor(Date.now()/7200000)}`} alt="Aktuelles Webcam-Bild der Olympiastrecke am Augsburger Eiskanal"/>
            <a href="https://www.eiskanal-augsburg.de/eiskanal-infos/eiskanal-webcam/" target="_blank" rel="noreferrer">Originalansicht <ExternalLink size={16}/></a>
          </div>
          <p>Aus Datenschutzgründen aktualisiert der Betreiber das Bild alle zwei Stunden.</p>
        </article>

        <article className="weatherCard">
          <div className="sectionHead">
            <div><span>AUGSBURG · 7 TAGE</span><h2>Wetterausblick</h2></div>
            <Droplets size={30}/>
          </div>
          <div className="forecastList">
            {data?.forecast.map((f,i)=><div className="forecastRow" key={f.date}>
              <b>{i===0?'Heute':day(f.date)}</b>
              <i>{icon(f.code)}</i>
              <div className="temps"><strong>{Math.round(f.tMax)}°</strong><span>{Math.round(f.tMin)}°</span></div>
              <div className="rain">{fmt(f.precip)} mm</div>
              <div className="wind"><Wind size={14}/>{Math.round(f.wind)} km/h</div>
            </div>)}
          </div>
          <p>Tageswerte · Niederschlag und maximale Windgeschwindigkeit · Open-Meteo</p>
        </article>
      </section>
    </main>

    <footer className="footer"><span>Messdaten: Bayerisches Landesamt für Umwelt / HND Bayern</span><span>Die Einschätzung ersetzt keine Prüfung der Streckenfreigabe vor Ort.</span></footer>
  </div>
}