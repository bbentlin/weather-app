import WeatherIcon from "@/components/WeatherIcons";

type Props = {
  searchParams: { city?: string, lat?: string, lon?: string };
};

type GeoResult = { name: string; latitude: number; longitude: number; country?: string; };
type WeatherData = {
  location: { name: string; lat: number; lon: number; };
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    wind_speed_10m: number;
    relative_humidity_2m: number; 
    weather_code: number;
  };
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    time: string[];
  };
};

async function geocodeCity(city: string): Promise<GeoResult | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", city);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const data = await res.json();
  const first = data?.results?.[0];
  if (!first) return null;
  return {
    name: [first.name, first.admin1, first.country].filter(Boolean).join(", "),
    latitude: first.latitude,
    longitude: first.longitude,
    country: first.country,
  };
}

async function fetchWeather(lat: number, lon: number, name: string): Promise<WeatherData> {
  const url = new URL("https://api.open-meteo.com/v1/forecast"); 
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m"
  );
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min");
  url.searchParams.set("timezone", "auto"); 

  const res = await fetch(url.toString(), { next: { revalidate: 600 } });
  if (!res.ok) throw new Error("Failed to fetch weather");
  const data = await res.json();

  return {
    location: { name, lat, lon },
    current: data.current,
    daily: {
      temperature_2m_max: data.daily.temperature_2m_max,
      temperature_2m_min: data.daily.temperature_2m_min,
      time: data.daily.time,
    },
  };
}

function describe(code: number): string {
  const map: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog", 
    48: "Rime fog",
    51: "Light drizzle",
    61: "Light rain",
    71: "Light snow",
    80: "Rain showers",
    95: "Thunderstorm",
  };
  return map[code] ?? "Unknown";
}

export default async function Weather({ searchParams }: Props) {
  const { city, lat, lon } = searchParams;

  let locationName = "Your location";
  let latNum: number | null = null;
  let lonNum: number | null = null;

  if (city) {
    const geo = await geocodeCity(city);
    if (!geo) {
      return (
        <main>
          <h1>Weather</h1>
          <p>Could not find "{city}". Try another city.</p>
          <p>← Back</p>
        </main>
      );
    }
    locationName = geo.name;
    latNum = geo.latitude;
    lonNum = geo.longitude;
  } else if (lat && lon) {
    latNum = Number(lat);
    lonNum = Number(lon);
  }

  if (latNum === null || lonNum === null) {
    return (
      <main>
        <h1>Weather</h1>
        <p>Provide a city or allow location access.</p>
        <p>← Back</p>
      </main>
    );
  }

  const data = await fetchWeather(latNum, lonNum, locationName);
  const c = data.current;

  return (
    <main>
      <h1>Weather - {data.location.name}</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-white/10 p-4">
          <div className="text-5xl font-bold">{Math.round(c.temperature_2m)}°</div>
          <div className="opacity-90 flex items-center gap-2">
            <WeatherIcon code={c.weather_code} />
            {describe(c.weather_code)}
          </div>
        </div>

        <div className="rounded-xl bg-white/10 p-4">
          <div className="opacity-80">Feels like</div>
          <div className="text-4xl font-semibold">
            {Math.round(c.apparent_temperature)}°
          </div>
        </div>

        <div className="rounded-xl bg-white/10 p-4">
          <div className="opacity-80">Wind</div>
          <div className="text-4xl font-semibold">
            {Math.round(c.wind_speed_10m)} km/h
          </div>
        </div>
      </div>

      <section>
        <h2>Next days</h2>
        <div>
          {data.daily.time.map((day, i) => (
            <div key={day}>
              <div>{new Date(day).toLocaleDateString()}</div>
              <div>
                {Math.round(data.daily.temperature_2m_max[i])}° / {Math.round(data.daily.temperature_2m_min[i])}°
              </div>
            </div>
          ))}
        </div>
      </section>

      <p><a href="/">← Back</a></p>
    </main>
  );
}