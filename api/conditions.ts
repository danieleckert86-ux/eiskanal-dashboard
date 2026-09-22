import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';

const WATER_URL = 'https://www.nid.bayern.de/wassertemperatur/bayern/augsburg-hochablass-12004002';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=48.34645&longitude=10.93594&current=temperature_2m,wind_speed_10m,cloud_cover,is_day&wind_speed_unit=kmh&timezone=Europe%2FBerlin';

function textOnly(html:string){
  return html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
}
function parseWater(html:string){
  const text=textOnly(html);
  const rows=[...text.matchAll(/(\d{2}\.\d{2}\.\d{4})\s+(\d{2}:\d{2})(?:\s*Uhr)?\s+([0-9]{1,2}[\.,][0-9])/g)];
  if(!rows.length) throw new Error('water_parse_failed');
  const row=rows[0], parts=row[1].split('.');
  return {temperature:Number(row[3].replace(',','.')),time:`${parts[2]}-${parts[1]}-${parts[0]}T${row[2]}:00+02:00`};
}
function classifySun(cloudCover:number,isDay:number){
  if(!isDay)return'cloudy';
  if(cloudCover<=25)return'sunny';
  if(cloudCover<=75)return'partly';
  return'cloudy';
}
export default async function handler(req:VercelRequest,res:VercelResponse){
  if(req.method!=='GET') return res.status(405).json({error:'method_not_allowed'});
  const sql=process.env.DATABASE_URL?neon(process.env.DATABASE_URL):null;
  try{
    const [waterResponse,weatherResponse]=await Promise.all([
      fetch(WATER_URL,{headers:{'user-agent':'Mozilla/5.0 EiskanalDashboard/1.0'}}),
      fetch(WEATHER_URL)
    ]);
    if(!waterResponse.ok||!weatherResponse.ok) throw new Error('source_fetch_failed');
    const water=parseWater(await waterResponse.text());
    const weather=await weatherResponse.json() as {current?:{temperature_2m?:number;wind_speed_10m?:number;cloud_cover?:number;is_day?:number;time?:string}};
    const c=weather.current;
    if(!c||typeof c.temperature_2m!=='number'||typeof c.wind_speed_10m!=='number'||typeof c.cloud_cover!=='number') throw new Error('weather_parse_failed');
    const data={waterTemp:water.temperature,waterTime:water.time,airTemp:c.temperature_2m,windSpeed:c.wind_speed_10m,cloudCover:c.cloud_cover,sunMode:classifySun(c.cloud_cover,c.is_day??0),weatherTime:c.time||''};
    if(sql){
      await sql`INSERT INTO live_conditions_cache (id,water_temp,water_time,air_temp,wind_speed,cloud_cover,sun_mode,weather_time,updated_at)
        VALUES (1,${data.waterTemp},${data.waterTime},${data.airTemp},${data.windSpeed},${data.cloudCover},${data.sunMode},${data.weatherTime},now())
        ON CONFLICT (id) DO UPDATE SET water_temp=excluded.water_temp,water_time=excluded.water_time,air_temp=excluded.air_temp,wind_speed=excluded.wind_speed,cloud_cover=excluded.cloud_cover,sun_mode=excluded.sun_mode,weather_time=excluded.weather_time,updated_at=now()`;
    }
    return res.status(200).json(data);
  }catch(e){
    console.error(e);
    if(sql){
      const rows=await sql`SELECT water_temp,water_time,air_temp,wind_speed,cloud_cover,sun_mode,weather_time FROM live_conditions_cache WHERE id=1`;
      if(rows.length){
        const r=rows[0];
        return res.status(200).json({waterTemp:r.water_temp,waterTime:r.water_time,airTemp:r.air_temp,windSpeed:r.wind_speed,cloudCover:r.cloud_cover,sunMode:r.sun_mode,weatherTime:r.weather_time,cached:true});
      }
    }
    return res.status(502).json({error:'Live-Daten konnten nicht geladen werden'});
  }
}