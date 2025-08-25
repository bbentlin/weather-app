"use client";

import { useEffect, useRef, useState } from "react";
import WeatherIcons from "../components/WeatherIcons";
import Card from "../components/Card";
import Button from "../components/Button";
import Sparkline from "../components/Sparkline";

type WeatherData = {
  location: { name: string; lat: number; lon: number };
  current: {
    time: string;
    is_day: number;
    temperature_2m: number;
    apparent_temperature: number;
    wind_speed_10m: number;
    relative_humidity_2m: number;
    weather_code: number;
    precipitation?: number;
  };
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    time: string[];
    precipitation_probability_max?: number[]; 
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    apparent_temperature: number[];
    wind_speed_10m: number[];
    precipitation: number[];
  };
  timezone: string;
};

type GeoResult = {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;             
  population?: number | null;  
};

// Helper to format place nicely
function formatPlace(g: GeoResult) {
  return [g.name, g.admin1, g.country].filter(Boolean).join(", ");
}

// Fetch multiple matches from our API route
async function geocodeCityList(q: string): Promise<GeoResult[]> {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const res = await fetch(`${base}/api/geocode?q=${encodeURIComponent(q)}&count=10`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.results ?? []) as GeoResult[];
}

function unitLabels(unit: "metric" | "us") {
  return {
    temp: unit === "us" ? "°F" : "°C",
    wind: unit === "us" ? "mph" : "km/h",
    precip: unit === "us" ? "in" : "mm", 
  };
}

function describe(code: number) {
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
  return map[code] ?? `Code ${code}`;
}

async function geocodeCity(city: string): Promise<GeoResult | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", city);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString());
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

async function ipName(): Promise<string | null> {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) return null;
    const j = await res.json();
    return j?.city && j?.country_name ? `${j.city}, ${j.country_name}` : j?.city || null;
  } catch {
    return null;
  }
}

// Reverse geocoder
async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/reverse-geocode?lat=${lat}&lon=${lon}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.name ?? (await ipName()) ?? null;
  } catch {
    return (await ipName()) ?? null;
  }
}

async function fetchWeather(
  lat: number,
  lon: number,
  name: string,
  unit: "metric" | "us"
): Promise<WeatherData> {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const res = await fetch(`${base}/api/weather?lat=${lat}&lon=${lon}&unit=${unit}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const raw = await res.text();
    let detail = raw;
    try {
      const j = JSON.parse(raw);
      // Prefer upstream body if available; fall back to error/status
      detail = j?.body ?? j?.message ?? j?.error ?? raw;
    } catch {
      // raw not JSON
    }
    throw new Error(`Failed to fetch weather (${res.status}): ${String(detail).slice(0, 500)}`);
  }

  const data = await res.json();
  return {
    location: { name, lat, lon },
    current: data.current,
    daily: {
      temperature_2m_max: data.daily.temperature_2m_max,
      temperature_2m_min: data.daily.temperature_2m_min,
      time: data.daily.time,
      precipitation_probability_max: data.daily.precipitation_probability_max,
    },
    hourly: {
      time: data.hourly.time,
      temperature_2m: data.hourly.temperature_2m,
      apparent_temperature: data.hourly.apparent_temperature,
      wind_speed_10m: data.hourly.wind_speed_10m,
      precipitation: data.hourly.precipitation, 
    },
    timezone: data.timezone,
  };
}

// Theme helper
function themeFrom(code?: number, isDay?: boolean): string {
  if (code == null) {
    return "bg-gradient-to-br from-sky-50 via-white to-slate-200 dark:from-sky-700/40 dark:via-indigo-900/40 dark:to-gray-950";
  }
  const day = !!isDay;
  // Clear / few clouds
  if ([0, 1, 2].includes(code)) {
    return day
      ? "bg-gradient-to-br from-sky-100 via-blue-200 to-indigo-300 dark:from-slate-900 dark:via-slate-950 dark:to-sky-900"
      : "bg-gradient-to-br from-indigo-900 via-slate-900 to-black";
  }
  // Overcast
  if (code === 3) {
    return "bg-gradient-to-br from-slate-100 via-slate-200 to-slate-300 dark:from-slate-900 dark:via-slate-950 dark:to-black";
  }
  // Fog
  if (code === 45 || code === 48) {
    return "bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-900 dark:via-gray-950 dark:to-black";
  }
  // Drizzle / rain
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return "bg-gradient-to-br from-sky-200 via-sky-300 to-slate-400 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-950";
  }
  // Snow
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return "bg-gradient-to-br from-blue-100 via-slate-200 to-slate-300 dark:from-slate-900 dark:via-blue-950 dark:to-slate-950";
  }
  // Thunder
  if ([95, 96, 99].includes(code)) {
    return "bg-gradient-to-br from-amber-100 via-sky-200 to-indigo-300 dark:from-indigo-950 dark:via-slate-950 dark:to-black";
  }
  return "bg-gradient-to-br from-sky-50 via-white to-slate-200 dark:from-sky-700/40 dark:via-indigo-900/40 dark:to-gray-950";
}

export default function Home() {
  const [city, setCity] = useState("");
  const [unit, setUnit] = useState<"metric" | "us">("us"); // default °F
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]); 
  const [themeClass, setThemeClass] = useState(
    "bg-gradient-to-br from-sky-50 via-white to-slate-200 dark:from-sky-700/40 dark:via-indigo-900/40 dark:to-gray-950"
  );
  const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusIdx, setFocusIdx] = useState<number>(-1); 
  const labels = unitLabels(unit);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const suggestionsRef = useRef<HTMLDivElement | null>(null); 
  const pendingArrowDownRef = useRef(false);

  // Load saved unit preference
  useEffect(() => {
    const saved = (localStorage.getItem("unit") as "metric" | "us") || "us";
    setUnit(saved);
  }, []);

  // Save unit preference when changed
  useEffect(() => {
    localStorage.setItem("unit", unit);
  }, [unit]);

  // Load/save recent
  useEffect(() => {
    try {
      const raw = localStorage.getItem("recentCities");
      if (raw) setRecent(JSON.parse(raw));
    } catch {}
  }, []);
  const addRecent = (name: string) => {
    setRecent((prev) => {
      const next = [name, ...prev.filter((c) => c.toLowerCase() !== name.toLowerCase())].slice(0, 5);
      localStorage.setItem("recentCities", JSON.stringify(next));
      return next;
    });
  };

  // Update background when weather changes
  useEffect(() => {
    if (weather?.current) {
      setThemeClass(themeFrom(weather.current.weather_code, weather.current.is_day === 1));
    } else {
      setThemeClass(themeFrom());
    }
  }, [weather?.current?.weather_code, weather?.current?.is_day]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (
        showSuggestions &&
        !suggestionsRef.current?.contains(t) &&
        !inputRef.current?.contains(t)
      ) {
        setShowSuggestions(false);
        setFocusIdx(-1);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showSuggestions]);

  // Choose a suggestion and fetch weather
  const chooseSuggestion = async (g: GeoResult) => {
    setShowSuggestions(false);
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWeather(g.latitude, g.longitude, formatPlace(g), unit);
      setWeather(data);
      addRecent(g.name.split(",")[0] ?? g.name);
      setCity("");
      inputRef.current?.blur();
      queueMicrotask(() =>
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    } catch (e) {
      console.error(e);
      setError("Failed to load weather data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Updated search: show list if multiple matches, else fetch directly
  const goToCity = async (nameOverride?: string) => {
    const q = (nameOverride ?? city).trim();
    if (!q) return;

    setError(null);
    try {
      const results = await geocodeCityList(q);
      if (!results.length) {
        setSuggestions([]);
        setShowSuggestions(false);
        setWeather(null);
        setError(`Could not find “${q}”. Try adding state/country.`);
        return;
      }
      if (results.length === 1) {
        await chooseSuggestion(results[0]);
        return;
      }
      setSuggestions(results.slice(0, 8));
      setShowSuggestions(true);
      // If ArrowDown triggered this fetch, preselect first item on arrival
      setFocusIdx(pendingArrowDownRef.current ? 0 : -1);
      pendingArrowDownRef.current = false; // reset
    } catch (e) {
      console.error(e);
      setWeather(null);
      setSuggestions([]);
      setShowSuggestions(false);
      setError("Search failed. Please try again.");
      pendingArrowDownRef.current = false;
    }
  };

  const resolveByIP = async () => {
    try {
      const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
      if (!res.ok) throw new Error("IP lookup failed");
      const j = await res.json();
      const { latitude, longitude, city: ipCity, country_name } = j;
      if (typeof latitude === "number" && typeof longitude === "number") {
        const locationName = ipCity ? `${ipCity}, ${country_name}` : "Your location";
        const data = await fetchWeather(latitude, longitude, locationName, unit);
        setWeather(data);
        setCity("");
        inputRef.current?.blur();
        queueMicrotask(() =>
          resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        );
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  const useMyLocation = async () => {
    setLoading(true);
    setError(null);
    try {
      const perm = await navigator.permissions?.query({ name: "geolocation" as any }).catch(() => null);
      if (perm?.state === "denied") {
        const ok = await resolveByIP();
        if (!ok) setError("Location permission denied. Enter a city instead.");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            const name = (await reverseGeocode(latitude, longitude)) ?? "Your location";
            const data = await fetchWeather(latitude, longitude, name, unit);
            setWeather(data);
            setCity("");
            inputRef.current?.blur();
            queueMicrotask(() =>
              resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
            );
          } catch (e) {
            console.error(e);
            setError("Failed to load weather data. Please try again.");
          } finally {
            setLoading(false);
          }
        },
        async () => {
          const ok = await resolveByIP();
          if (!ok) setError("Unable to get your location. Enter a city instead.");
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } catch (e) {
      const ok = await resolveByIP();
      if (!ok) setError("Unable to get your location. Enter a city instead.");
      setLoading(false);
    }
  };

  const switchUnit = (newUnit: "metric" | "us") => {
    if (newUnit === unit) return;
    setUnit(newUnit);
    if (weather) {
      setLoading(true);
      fetchWeather(weather.location.lat, weather.location.lon, weather.location.name, newUnit)
        .then(setWeather)
        .catch(() => setError("Failed to update units."))
        .finally(() => setLoading(false));
    }
  };

  // Helper to format precipitation nicely
  function formatPrecip(val: number, unit: "metric" | "us") {
    if (!Number.isFinite(val)) return "0";
    return unit === "us" ? val.toFixed(val < 1 ? 2 : 2) : val.toFixed(val < 1 ? 1 : 1);
  }

  return (
    <main className={`min-h-screen flex flex-col transition-colors duration-500 ${themeClass}`}>
      <div className="max-w-4xl w-full mx-auto px-6 pt-12 pb-6">
        {/* Search form (animated in) */}
        <section className="text-center animate-fadeUp">
          <h1
            className="
              inline-block text-5xl sm:text-6xl font-extrabold tracking-tight
              leading-[1.15] pb-[2px] mb-3
              bg-clip-text text-transparent
              bg-gradient-to-b
              from-gray-900 via-sky-700 to-blue-600
              dark:from-white dark:via-blue-200 dark:to-blue-400
              drop-shadow-[0_1px_1px_rgba(0,0,0,0.12)] dark:drop-shadow-none
            "
          >
            Current Weather Conditions
          </h1>
          <p className="text-lg opacity-90 mb-8">Search by city or use your location.</p>

          <div className="flex flex-wrap gap-3 justify-center">
            <input
              ref={inputRef}
              className="
                flex-1 min-w-[260px] max-w-md rounded-xl px-4 py-3
                bg-white text-gray-900 placeholder-gray-500
                dark:bg-white/10 dark:text-white
                ring-1 ring-black/10 dark:ring-white/10
                focus:ring-2 focus:ring-sky-400/60 dark:focus:ring-sky-300/40
                outline-none shadow-sm
              "
              type="text"
              placeholder="Enter city (e.g., Springfield, IL)"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setShowSuggestions(false);
                setFocusIdx(-1);
              }}
              aria-label="City"
              aria-expanded={showSuggestions}
              aria-controls="city-suggestions"
              role="combobox"
              autoComplete="off"
              disabled={loading}
              aria-activedescendant={focusIdx >= 0 ? `city-opt-${focusIdx}` : undefined} // a11y hint
              onKeyDown={(e) => {
                const key = e.key || (e as any).keyIdentifier; // Safari fallback
                const isDown = key === "ArrowDown" || key === "Down" || (e as any).keyCode === 40;
                const isUp = key === "ArrowUp" || key === "Up" || (e as any).keyCode === 38;

                if (showSuggestions && suggestions.length) {
                  if (isDown) {
                    e.preventDefault();
                    setFocusIdx((i) => (i < 0 ? 0 : (i + 1) % suggestions.length));
                  } else if (isUp) {
                    e.preventDefault();
                    setFocusIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
                  } else if (key === "Enter") {
                    e.preventDefault();
                    if (focusIdx >= 0) {
                      chooseSuggestion(suggestions[focusIdx]);
                    } else {
                      goToCity();
                    }
                  } else if (key === "Escape") {
                    setShowSuggestions(false);
                    setFocusIdx(-1);
                  }
                } else {
                  // No list visible yet: ArrowDown should open it and preselect first item
                  if (isDown && city.trim()) {
                    e.preventDefault();
                    pendingArrowDownRef.current = true;
                    goToCity();
                    return;
                  }
                  if (key === "Enter") {
                    goToCity();
                  }
                }
              }}
            />
            <Button variant="filled" size="md" onClick={() => goToCity()} disabled={loading || !city.trim()}>
              {loading ? "Loading..." : "Get Weather"}
            </Button>
            <Button variant="outline" size="md" onClick={useMyLocation} disabled={loading}>
              {loading ? "Loading..." : "Use my location"}
            </Button>
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="mt-3 max-w-xl mx-auto text-left" ref={suggestionsRef}>
              <div
                id="city-suggestions"
                className="rounded-2xl ring-1 ring-black/10 dark:ring-white/10 bg-white/90 dark:bg-white/5 backdrop-blur-md shadow-lg overflow-hidden"
                role="listbox"
              >
                <ul className="divide-y divide-black/5 dark:divide-white/10">
                  {suggestions.map((g, idx) => {
                    const active = idx === focusIdx;
                    return (
                      <li key={`${g.latitude},${g.longitude}`}>
                        <button
                          id={`city-opt-${idx}`} // match aria-activedescendant
                          role="option"
                          aria-selected={active}
                          className={`w-full text-left px-4 py-3 transition flex items-center justify-between ${
                            active ? "bg-black/5 dark:bg-white/10" : "hover:bg-black/5 dark:hover:bg-white/10"
                          }`}
                          onMouseEnter={() => setFocusIdx(idx)}
                          onClick={() => chooseSuggestion(g)}
                        >
                          <span className="truncate">{formatPlace(g)}</span>
                          {typeof g.population === "number" && g.population > 0 && (
                            <span className="ml-3 text-xs px-2 py-0.5 rounded-full bg-black/10 text-gray-800 dark:bg-white/15 dark:text-white/90">
                              pop {g.population.toLocaleString()}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          <div className="mt-5 inline-flex gap-1 rounded-xl p-1 shadow-md bg-black/5 dark:bg-white/10">
            <Button
              variant={unit === "metric" ? "filled" : "ghost"}
              size="sm"
              onClick={() => switchUnit("metric")}
              aria-pressed={unit === "metric"}
              disabled={loading}
            >
              °C
            </Button>
            <Button
              variant={unit === "us" ? "filled" : "ghost"}
              size="sm"
              onClick={() => switchUnit("us")}
              aria-pressed={unit === "us"}
              disabled={loading}
            >
              °F
            </Button>
          </div>

          {error && (
            <div className="mt-4 max-w-md mx-auto rounded-lg bg-red-500/20 border border-red-500/30 p-3">
              {error}
            </div>
          )}
        </section>

        {/* Results container (animate in) */}
        <section ref={resultsRef} className="mt-10 animate-fadeUp">
          {!weather && !loading && (
            <div className="max-w-3xl mx-auto text-center opacity-80">
              Enter a city or use your location to see the weather.
            </div>
          )}

          {/* Loading skeleton cards */}
          {loading && (
            <div className="grid gap-4 md:grid-cols-4 items-stretch">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <div className="h-10 w-24 bg-black/10 dark:bg-white/20 rounded animate-pulse mb-2" />
                  <div className="h-4 w-40 bg-black/10 dark:bg-white/20 rounded animate-pulse" />
                </Card>
              ))}
            </div>
          )}

          {weather && !loading && (
            <>
              {/* Location header at the top of the results */}
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-2xl font-bold">{weather.location.name}</h2>
              </div>

              {/* Current/Feels/Wind/Precipitation cards */}
              <div className="grid gap-4 md:grid-cols-4 items-stretch">
                <Card>
                  <div className="flex items-end gap-2">
                    <div className="text-6xl font-bold">
                      {Math.round(weather.current.temperature_2m)}
                      <span className="text-4xl">{labels.temp}</span>
                    </div>
                    <div className="mb-2">
                      <WeatherIcons code={weather.current.weather_code} className="text-4xl" />
                    </div>
                  </div>
                  <div className="text-lg mt-1">{describe(weather.current.weather_code)}</div>

                  {/* Next 24h sparkline */}
                  {(() => {
                    const startIdx = Math.max(
                      weather.hourly.time.findIndex((t) => t >= weather.current.time),
                      0
                    );
                    const temps = weather.hourly.temperature_2m.slice(startIdx, startIdx + 24);
                    if (temps.length < 2) return null;
                    return (
                      <div className="mt-4">
                        <div className="text-xs uppercase opacity-70 mb-1">Next 24h</div>
                        <Sparkline data={temps} height={42} />
                      </div>
                    );
                  })()}
                </Card>

                <Card>
                  <div className="text-sm uppercase tracking-wider opacity-80 mb-1">Feels like</div>
                  <div className="text-4xl font-semibold">
                    {Math.round(weather.current.apparent_temperature)}
                    {labels.temp}
                  </div>
                  <div className="mt-2 text-sm opacity-70">
                    Humidity: {weather.current.relative_humidity_2m}%
                  </div>

                  {(() => {
                    const startIdx = Math.max(
                      weather.hourly.time.findIndex((t) => t >= weather.current.time),
                      0
                    );
                    const feels = weather.hourly.apparent_temperature.slice(startIdx, startIdx + 24);
                    if (feels.length < 2) return null;
                    return (
                      <div className="mt-4 text-rose-500 dark:text-rose-300">
                        <div className="text-xs uppercase opacity-70 mb-1 text-inherit">Next 24h</div>
                        <Sparkline data={feels} height={42} />
                      </div>
                    );
                  })()}
                </Card>

                <Card>
                  <div className="text-sm uppercase tracking-wider opacity-80 mb-1">Wind</div>
                  <div className="text-4xl font-semibold">
                    {Math.round(weather.current.wind_speed_10m)} {labels.wind}
                  </div>

                  {(() => {
                    const startIdx = Math.max(
                      weather.hourly.time.findIndex((t) => t >= weather.current.time),
                      0
                    );
                    const wind = weather.hourly.wind_speed_10m.slice(startIdx, startIdx + 24);
                    if (wind.length < 2) return null;
                    return (
                      <div className="mt-4 text-emerald-600 dark:text-emerald-300">
                        <div className="text-xs uppercase opacity-70 mb-1 text-inherit">Next 24h</div>
                        <Sparkline data={wind} height={42} />
                      </div>
                    );
                  })()}
                </Card>

                {/* Precipitation */}
                <Card>
                  <div className="text-sm uppercase tracking-wider opacity-80 mb-1">Precipitation</div>
                  {(() => {
                    const startIdx = Math.max(
                      weather.hourly.time.findIndex((t) => t >= weather.current.time),
                      0
                    );
                    const precipNow =
                      weather.current.precipitation ??
                      weather.hourly.precipitation[startIdx] ??
                      0;

                    return (
                      <>
                        <div className="text-4xl font-semibold">
                          {formatPrecip(precipNow, unit)} {labels.precip}
                        </div>
                        <div className="mt-4 text-sky-700 dark:text-sky-300">
                          <div className="text-xs uppercase opacity-70 mb-1 text-inherit">Next 24h</div>
                          <Sparkline
                            data={weather.hourly.precipitation.slice(startIdx, startIdx + 24)}
                            height={42}
                          />
                        </div>
                      </>
                    );
                  })()}
                </Card>
              </div>

              <section className="mt-8">
                <h2 className="text-xl font-semibold mb-3 animate-fadeUp" style={{ animationDelay: "60ms" }}>
                  5-Day Forecast
                </h2>
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
                  {(() => {
                    const todayStr = weather.current.time.slice(0, 10);
                    const startIdx = Math.max(weather.daily.time.findIndex((d) => d >= todayStr), 0);
                    const days = weather.daily.time.slice(startIdx, startIdx + 5).map((day, i) => ({ day, i: startIdx + i }));
                    const weekday = (d: string) => {
                      const label = new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: weather.timezone }).format(
                        new Date(d + "T12:00:00")
                      );
                      return label === "Thu" ? "Thur" : label;
                    };
                    return days.map(({ day, i }, idx) => (
                      <Card key={day} padding="p-3" wrapperClassName="animate-fadeUp">
                        <div className="font-medium">{idx === 0 ? "Today" : weekday(day)}</div>
                        <div className="text-2xl font-semibold mt-1">
                          {Math.round(weather.daily.temperature_2m_max[i])}{labels.temp}
                        </div>
                        <div className="text-sm opacity-80">
                          Low: {Math.round(weather.daily.temperature_2m_min[i])}{labels.temp}
                        </div>
                        {Number.isFinite(weather.daily.precipitation_probability_max?.[i]) && (
                          <div className="text-sm opacity-80 mt-1">
                            Precip Chance: {Math.round(weather.daily.precipitation_probability_max![i])}%
                          </div>
                        )}
                      </Card>
                    ));
                  })()}
                </div>
              </section>
            </>
          )}
        </section>
      </div>

      <footer className="p-4 text-center opacity-80 text-sm">
        © {new Date().getFullYear()} BentlinDevelopment
      </footer>
    </main>
  );
}