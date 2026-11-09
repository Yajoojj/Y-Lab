/**
 * Weather system: syncs real-world weather via Open-Meteo (no key, no CORS issues).
 * Falls back to time-of-day cycle when geolocation is denied or API fails.
 */

export interface WeatherState {
  /** 0=clear, 1=mainly_clear, 2=partly_cloudy, 3=overcast, 45/48=fog,
   *  51-57=drizzle, 61-67=rain, 71-77=snow, 80-82=showers, 95-99=thunderstorm */
  code: number;
  temperature: number;   // °C
  cloudCover: number;    // 0-100
  precipitation: number; // mm
  windSpeed: number;     // km/h
  isDay: boolean;
  /** Normalized intensity for rain/shader: 0=dry, 1=heavy rain */
  rainIntensity: number;
  /** Fog density multiplier: 0=clear, 1=dense fog */
  fogDensity: number;
  /** Sky brightness: 0=night, 1=day */
  dayFactor: number;
  /** Cloud opacity: 0=clear, 1=overcast */
  cloudFactor: number;
}

const DEFAULT_WEATHER: WeatherState = {
  code: 0,
  temperature: 22,
  cloudCover: 20,
  precipitation: 0,
  windSpeed: 5,
  isDay: true,
  rainIntensity: 0,
  fogDensity: 0,
  dayFactor: 1,
  cloudFactor: 0.2,
};

function wmoToRain(code: number): number {
  if (code >= 95) return 0.9;      // thunderstorm
  if (code >= 80) return 0.7;      // showers
  if (code >= 65) return 0.8;      // heavy rain
  if (code >= 63) return 0.5;      // moderate rain
  if (code >= 61) return 0.3;      // slight rain
  if (code >= 55) return 0.25;     // dense drizzle
  if (code >= 53) return 0.15;     // moderate drizzle
  if (code >= 51) return 0.08;     // light drizzle
  return 0;
}

function wmoToFog(code: number, cloudCover: number): number {
  if (code === 45 || code === 48) return 0.8;
  if (cloudCover > 80) return 0.15;
  if (cloudCover > 60) return 0.05;
  return 0;
}

function computeDerived(w: Omit<WeatherState, "rainIntensity" | "fogDensity" | "dayFactor" | "cloudFactor">): WeatherState {
  const rainIntensity = wmoToRain(w.code);
  const fogDensity = wmoToFog(w.code, w.cloudCover);
  const hour = new Date().getHours();
  // Smooth day/night: sunrise ~6h, sunset ~18h
  let dayFactor: number;
  if (w.isDay !== undefined) {
    dayFactor = w.isDay ? 1 : 0;
  } else {
    dayFactor = hour >= 6 && hour < 18 ? 1 : 0;
  }
  // Smooth transition at boundaries
  if (hour >= 5 && hour < 7) dayFactor = (hour - 5) / 2;
  else if (hour >= 17 && hour < 19) dayFactor = 1 - (hour - 17) / 2;

  const cloudFactor = Math.min(1, w.cloudCover / 100);

  return { ...w, rainIntensity, fogDensity, dayFactor, cloudFactor };
}

async function fetchGeolocation(): Promise<{ lat: number; lon: number } | null> {
  if (!navigator.geolocation) return null;
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 5000,
        maximumAge: 300_000, // cache 5 min
      });
    });
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  } catch {
    return null;
  }
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherState | null> {
  const params = new URLSearchParams({
    // ~11 km de precisão: suficiente para o clima, sem expor a localização exata
    latitude: lat.toFixed(1),
    longitude: lon.toFixed(1),
    current: "temperature_2m,weather_code,wind_speed_10m,cloud_cover,precipitation,is_day",
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!res.ok) return null;
    const data = await res.json() as {
      current?: {
        temperature_2m: number;
        weather_code: number;
        wind_speed_10m: number;
        cloud_cover: number;
        precipitation: number;
        is_day: number;
      };
    };
    if (!data.current) return null;
    const c = data.current;
    return computeDerived({
      code: c.weather_code,
      temperature: c.temperature_2m,
      cloudCover: c.cloud_cover,
      precipitation: c.precipitation,
      windSpeed: c.wind_speed_10m,
      isDay: c.is_day === 1,
    });
  } catch {
    return null;
  }
}

/** Time-based fallback when geolocation/API unavailable */
function timeFallback(): WeatherState {
  const hour = new Date().getHours();
  const isDay = hour >= 6 && hour < 18;
  // Simulate mild cloud variation through the day
  const cloudCover = 15 + Math.sin(hour / 3) * 10;
  return computeDerived({
    code: isDay ? 1 : 0,
    temperature: isDay ? 24 : 18,
    cloudCover,
    precipitation: 0,
    windSpeed: 8,
    isDay,
  });
}

export class WeatherSystem {
  state: WeatherState = DEFAULT_WEATHER;
  private lastFetch = 0;
  private intervalMs = 5 * 60_000; // refresh every 5 min
  private pending = false;

  constructor() {
    this.state = timeFallback();
    this.refresh();
  }

  async refresh(): Promise<void> {
    if (this.pending) return;
    const now = Date.now();
    if (now - this.lastFetch < this.intervalMs) return;
    this.pending = true;
    try {
      const loc = await fetchGeolocation();
      if (loc) {
        const w = await fetchWeather(loc.lat, loc.lon);
        if (w) {
          this.state = w;
          this.lastFetch = now;
          return;
        }
      }
      // Fallback
      this.state = timeFallback();
      this.lastFetch = now;
    } finally {
      this.pending = false;
    }
  }

  /** Call each frame to smoothly interpolate toward target weather */
  tick(dt: number): void {
    // Auto-refresh periodically
    if (Date.now() - this.lastFetch > this.intervalMs) {
      this.refresh();
    }
    // Smooth transitions could go here; currently instant from API
    void dt;
  }
}