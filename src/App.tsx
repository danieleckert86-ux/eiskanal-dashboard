import { useEffect, useMemo, useState } from 'react';
import { Cloud, Droplets, RefreshCw, ShieldCheck, Sun, Thermometer, Waves, Wind } from 'lucide-react';

type Level = 'VERY_WARM' | 'WARM' | 'MILD' | 'FRESH' | 'COOL' | 'COLD' | 'VERY_COLD' | 'ICY';
type SunMode = 'cloudy' | 'partly' | 'sunny';
type Warmth = 'cold' | 'normal' | 'warm';
type Conditions = { waterTemp:number; waterTime:string; airTemp:number; windSpeed:number; cloudCover:number; sunMode:SunMode; weatherTime:string };

const order: Level[] = ['VERY_WARM','WARM','MILD','FRESH','COOL','COLD','VERY_COLD','ICY'];
const labels: Record<Level,string> = { VERY_WARM:'Sehr warm', WARM:'Warm', MILD:'Mild', FRESH:'Frisch', COOL:'Kühl', COLD:'Kalt', VERY_COLD:'Sehr kalt', ICY:'Eisig' };
const clothes: Record<Level,{main:string[];optional:string[]}> = {
  VERY_WARM:{main:[],optional:['Neoprenshirt kurzarm']},
  WARM:{main:['Neoprenshirt kurzarm'],optional:[]},
  MILD:{main:['Neoprenshirt Langarm'],optional:[]},
  FRESH:{main:['Neoprenshirt kurzarm','Paddeljacke'],optional:[]},
  COOL:{main:['Neoprenshirt Langarm','Paddeljacke'],optional:[]},
  COLD:{main:['LongJohn','Neoprenshirt kurzarm','Paddeljacke'],optional:[]},
  VERY_COLD:{main:['LongJohn','Neoprenshirt Langarm','Paddeljacke'],optional:[]},
  ICY:{main:['LongJohn','Neoprenshirt Langarm','Paddeljacke'],optional:[]}
};

function shift(level:Level,delta:number){ return order[Math.max(0,Math.min(order.length-1,order.indexOf(level)+delta))]; }
function baseLevel(w:number,a:number):Level{
  if(w>=20){ if(a<5)return'COOL'; if(a<15)return'FRESH'; if(a<20)return'MILD'; if(a<25)return'WARM'; return'VERY_WARM'; }
  if(w>=18){ if(a<10)return'COOL'; if(a<15)return'FRESH'; if(a<20)return'MILD'; if(a<25)return'WARM'; return'VERY_WARM'; }
  if(w>=16){ if(a<5)return'COLD'; if(a<15)return'COOL'; if(a<20)return'FRESH'; if(a<25)return'MILD'; return'WARM'; }
  if(w>=14){ if(a<10)return'COLD'; if(a<15)return'COOL'; if(a<20)return'FRESH'; if(a<25)return'MILD'; return'WARM'; }
  if(w>=12)return a<5?'VERY_COLD':'COLD';
  if(w>=10)return a<10?'VERY_COLD':'COLD';
  if(w>=8){ if(a<5)return'ICY'; if(a<20)return'VERY_COLD'; return'COLD'; }
  return a<15?'ICY':'VERY_COLD';
}
function minimum(w:number):Level|null{ if(w>=16)return null; if(w>=14)return'FRESH'; if(w>=8)return'COLD'; return'VERY_COLD'; }
function applyMinimum(level:Level,min:Level|null){ return min&&order.indexOf(level)<order.indexOf(min)?min:level; }
function gloves(a:number,v:number){ let s:'none'|'optional'|'recommended'=a<5?'recommended':a<10?'optional':'none'; if(a>=10&&a<15&&v>=20)s='optional'; if(v>=20&&s==='optional')s='recommended'; return s; }
function hood(w:number,a:number){ if(w>15)return a<10?'optional':'none'; if(w>=12)return a<5?'recommended':a<15?'optional':'none'; if(w>=10)return a<10?'recommended':a<20?'optional':'none'; if(w>=8)return a<15?'recommended':'optional'; return a<20?'recommended':'optional'; }
function stateText(s:string){ return s==='recommended'?'Empfohlen':s==='optional'?'Optional':'Nicht erforderlich'; }

export default function App(){
  const [live,setLive]=useState<Conditions|null>(null);
  const [water,setWater]=useState(18);
  const [air,setAir]=useState(12);
  const [wind,setWind]=useState(5);
  const [sun,setSun]=useState<SunMode>('cloudy');
  const [warmth,setWarmth]=useState<Warmth>('normal');
  const [manual,setManual]=useState(false);
  const [loading,setLoading]=useState(true);
  const [errorMsg,setErrorMsg]=useState('');

  async function load(){
    setLoading(true); setErrorMsg('');
    try{
      const r=await fetch('/api/conditions');
      if(!r.ok) throw new Error('conditions_fetch_failed');
      const d=await r.json() as Conditions; setLive(d);
      if(!manual){ setWater(d.waterTemp); setAir(d.airTemp); setWind(d.windSpeed); setSun(d.sunMode); }
    }catch{ setErrorMsg('Live-Daten konnten nicht geladen werden. Die manuelle Einstellung bleibt verfügbar.'); }
    finally{ setLoading(false); }
  }
  useEffect(()=>{ void load(); },[]);

  const result=useMemo(()=>{
    const base=baseLevel(water,air);
    const afterWind=shift(base,wind>=30?2:wind>=20?1:0);
    const sunApplies=sun==='sunny'&&wind<10&&air>=10;
    const afterSun=shift(afterWind,sunApplies?-1:0);
    const afterPersonal=shift(afterSun,warmth==='cold'?1:warmth==='warm'?-1:0);
    const min=minimum(water);
    const finalLevel=applyMinimum(afterPersonal,min);
    return{base,afterWind,sunApplies,afterPersonal,min,finalLevel,gloves:gloves(air,wind),hood:hood(water,air)};
  },[water,air,wind,sun,warmth]);

  const outfit=clothes[result.finalLevel];
  const optional=[...outfit.optional];
  const extras:string[]=[];
  if(result.gloves==='optional')optional.push('Neoprenhandschuhe'); else if(result.gloves==='recommended')extras.push('Neoprenhandschuhe');
  if(result.hood==='optional')optional.push('Neoprenhaube'); else if(result.hood==='recommended')extras.push('Neoprenhaube');

  function takeLive(){ if(!live)return; setWater(live.waterTemp); setAir(live.airTemp); setWind(live.windSpeed); setSun(live.sunMode); setManual(false); }
  const sunText=sun==='sunny'?'Sonnig':sun==='partly'?'Teilweise sonnig':'Bewölkt';

  return <main className="shell">
    <header className="hero">
      <div><div className="eyebrow"><Waves size={17}/> Augsburg · Eiskanal</div><h1>Was ziehe ich heute fürs Kajak an?</h1><p>Live-Wasser vom Hochablass und aktuelles Wetter am Eiskanal – kombiniert mit deinem Wärmeempfinden.</p></div>
      <button className="primary" onClick={()=>void load()} disabled={loading}><RefreshCw size={18} className={loading?'spin':''}/>{loading?'Aktualisiere…':'Live-Daten neu laden'}</button>
    </header>

    {errorMsg&&<div className="notice error">{errorMsg}</div>}

    <section className="metrics">
      <article><Droplets/><span>Wasser Hochablass</span><b>{(live?.waterTemp??water).toFixed(1)} °C</b><small>{live?.waterTime||'manuell'}</small></article>
      <article><Thermometer/><span>Luft am Eiskanal</span><b>{(live?.airTemp??air).toFixed(1)} °C</b><small>{live?.weatherTime||'manuell'}</small></article>
      <article><Wind/><span>Wind</span><b>{(live?.windSpeed??wind).toFixed(0)} km/h</b><small>10 m über Grund</small></article>
      <article>{sun==='sunny'?<Sun/>:<Cloud/>}<span>Sonne</span><b>{live?(live.sunMode==='sunny'?'Sonnig':live.sunMode==='partly'?'Teilweise':'Bewölkt'):sunText}</b><small>{live?live.cloudCover+' % Bewölkung':'manuell'}</small></article>
    </section>

    <section className="result">
      <div className={'level '+result.finalLevel}><span>Deine Wärmestufe</span><strong>{labels[result.finalLevel]}</strong></div>
      <div className="outfit">
        <div><h2>Empfohlen</h2>{outfit.main.length?outfit.main.map(x=><p key={x}>✓ {x}</p>):<p className="muted">Keine zusätzliche Neopren-Oberbekleidung nötig.</p>}{extras.map(x=><p key={x}>✓ {x}</p>)}</div>
        {optional.length>0&&<div><h2>Optional</h2>{optional.map(x=><p className="optional" key={x}>+ {x}</p>)}</div>}
        <div className="always"><h2>Immer dabei</h2><span>Neoprenschuhe · Schwimmweste · Spritzdecke · Helm</span></div>
      </div>
    </section>

    <section className="card">
      <div className="cardhead"><div><div className="eyebrow">Feinabstimmung</div><h2>Bedingungen anpassen</h2></div><button className="link" onClick={()=>setManual(!manual)}>{manual?'Live-Werte verwenden':'Manuell anpassen'}</button></div>
      {manual&&<div className="controls">
        <label>Wasser <b>{water.toFixed(1)} °C</b><input type="range" min="5" max="26" step="0.5" value={water} onChange={e=>setWater(Number(e.target.value))}/></label>
        <label>Luft <b>{air.toFixed(1)} °C</b><input type="range" min="-5" max="35" step="0.5" value={air} onChange={e=>setAir(Number(e.target.value))}/></label>
        <label>Wind <b>{wind.toFixed(0)} km/h</b><input type="range" min="0" max="50" value={wind} onChange={e=>setWind(Number(e.target.value))}/></label>
        <div><span>Sonnigkeit</span><div className="segments"><button className={sun==='cloudy'?'on':''} onClick={()=>setSun('cloudy')}>Bewölkt</button><button className={sun==='partly'?'on':''} onClick={()=>setSun('partly')}>Teilweise</button><button className={sun==='sunny'?'on':''} onClick={()=>setSun('sunny')}>Sonnig</button></div></div>
        <button className="primary" onClick={takeLive} disabled={!live}>Live-Werte übernehmen</button>
      </div>}
      {!manual&&<p className="muted">Aktuell werden die Live-Werte verwendet.</p>}
      <div className="warmth"><span>Persönliches Wärmeempfinden</span><div className="segments"><button className={warmth==='cold'?'on':''} onClick={()=>setWarmth('cold')}>Ich friere schnell</button><button className={warmth==='normal'?'on':''} onClick={()=>setWarmth('normal')}>Normal</button><button className={warmth==='warm'?'on':''} onClick={()=>setWarmth('warm')}>Mir wird schnell warm</button></div></div>
    </section>

    <section className="card">
      <h2>Warum diese Empfehlung?</h2>
      <div className="trace">
        <span>Grundstufe<b>{labels[result.base]}</b></span>
        <span>Wind<b>{result.afterWind===result.base?'keine Änderung':wind>=30?'2 Stufen kälter':'1 Stufe kälter'}</b></span>
        <span>Sonne<b>{result.sunApplies?'1 Stufe wärmer':'keine Änderung'}</b></span>
        <span>Wärmeempfinden<b>{warmth==='normal'?'keine Änderung':warmth==='cold'?'1 Stufe kälter':'1 Stufe wärmer'}</b></span>
        <span>Kaltwassergrenze<b>{result.min&&order.indexOf(result.afterPersonal)<order.indexOf(result.min)?'mindestens '+labels[result.min]:'keine Änderung'}</b></span>
      </div>
      <div className="extras"><span>Neoprenhaube <b>{stateText(result.hood)}</b></span><span>Neoprenhandschuhe <b>{stateText(result.gloves)}</b></span></div>
    </section>

    {water<15&&<section className="notice safety"><ShieldCheck/><div><b>Kaltes Wasser</b><p>Kaltes Wasser kann Atmung und Bewegungsfähigkeit unmittelbar nach einer Kenterung beeinträchtigen. Die Empfehlung ist auf kurze Schwimmeinlagen beim Wildwasserkajak ausgelegt.</p>{water<10&&<p><b>Unter 10 °C:</b> LongJohn und Paddeljacke bieten bei längerer Immersion nicht denselben Schutz wie ein Trockenanzug.</p>}</div></section>}

    <footer>Wasser: NID Bayern · Augsburg Hochablaß &nbsp;·&nbsp; Wetter: Open-Meteo · Eiskanal Augsburg</footer>
  </main>;
}