import DashboardClient, { type WaterData, type WeatherData } from "./dashboard-client";
import { GET as getWaterData } from "./api/water-data/route";

// Render live data on the server so the dashboard isn't empty when
// a phone/browser delays or blocks JavaScript fetches.
export const dynamic = "force-dynamic";

const WEATHER_URL = "https://api.open-meteo.com/v1/forecast?latitude=48.348&longitude=10.93&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&timezone=Europe%2FBerlin&forecast_days=7";

async function initialWater(): Promise<WaterData | null> {
  try {
    const response = await getWaterData();
    if (!response.ok) return null;
    return await response.json() as WaterData;
  } catch (error) {
    console.error("Water data preload failed", error);
    return null;
  }
}

async function initialWeather(): Promise<WeatherData | null> {
  try {
    const response = await fetch(WEATHER_URL, { next: { revalidate: 300 }, signal: AbortSignal.timeout(6000) });
    if (!response.ok) return null;
    return await response.json() as WeatherData;
  } catch (error) {
    console.error("Weather preload failed", error);
    return null;
  }
}

export default async function Home() {
  const [water, weather] = await Promise.all([initialWater(), initialWeather()]);
  return <DashboardClient initialWater={water} initialWeather={weather} initialNow={Date.now()} />;
}
