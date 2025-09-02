"use client";

import { useEffect, useRef, useState } from "react";
import WeatherIcons from "@/components/WeatherIcons";
import Card from "../components/Card";
import Button from "../components/Button";
import Sparkline from "../components/Sparkline";
import Aurora from "../components/Aurora";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import MapPicker from "@/components/MapPicker";

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
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max?: number[];
    weather_code?: number[];
    sunrise?: string[];   
    sunset?: string[];    
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

type Place = { name: string; lat: number; lon: number };


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
      // Prefer upstream body
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
      weather_code: data.daily.weather_code,
      sunrise: data.daily.sunrise,   // added
      sunset: data.daily.sunset,     // added
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

type AuroraTheme = {
  colorsA: [string, string, string];
  colorsB: [string, string, string];
  opacityA: number;
  opacityB: number;
};

function auroraFrom(code?: number, isDay?: boolean): AuroraTheme {
  const day = !!isDay;
  // Defaults
  let A: [string, string, string] = ["#22d3ee", "#a78bfa", "#f472b6"];
  let B: [string, string, string] = ["#60a5fa", "#34d399", "#22d3ee"];
  let oa = day ? 0.55 : 0.40;
  let ob = day ? 0.35 : 0.28;

  if (code == null) return { colorsA: A, colorsB: B, opacityA: oa, opacityB: ob };

  // Clear / few clouds
  if ([0, 1, 2].includes(code)) {
    A = day ? ["#22d3ee", "#a78bfa", "#f472b6"] : ["#0ea5e9", "#6366f1", "#06b6d4"];
    B = day ? ["#60a5fa", "#34d399", "#22d3ee"] : ["#312e81", "#0ea5e9", "#7c3aed"];
  }
  // Overcast
  else if (code === 3) {
    A = day ? ["#93c5fd", "#a5b4fc", "#a7f3d0"] : ["#1d4ed8", "#3730a3", "#0f766e"];
    B = day ? ["#7dd3fc", "#6ee7b7", "#93c5fd"] : ["#0ea5e9", "#14b8a6", "#1e3a8a"];
  }
  // Fog
  else if (code === 45 || code === 48) {
    A = day ? ["#cbd5e1", "#a3a3a3", "#93c5fd"] : ["#334155", "#475569", "#1e40af"];
    B = day ? ["#a5b4fc", "#e2e8f0", "#94a3b8"] : ["#0ea5e9", "#64748b", "#1f2937"];
  }
  // Drizzle / rain
  else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    A = day ? ["#38bdf8", "#6366f1", "#14b8a6"] : ["#0ea5e9", "#312e81", "#06b6d4"];
    B = day ? ["#60a5fa", "#22d3ee", "#0ea5e9"] : ["#1e3a8a", "#075985", "#3730a3"];
  }
  // Snow
  else if ([71, 73, 75, 77, 85, 86].includes(code)) {
    A = day ? ["#93c5fd", "#bfdbfe", "#e0e7ff"] : ["#1e3a8a", "#0ea5e9", "#6366f1"];
    B = day ? ["#7dd3fc", "#a7f3d0", "#60a5fa"] : ["#0ea5e9", "#164e63", "#334155"];
  }
  // Thunder
  else if ([95, 96, 99].includes(code)) {
    A = day ? ["#f59e0b", "#22d3ee", "#6366f1"] : ["#f59e0b", "#7c3aed", "#0ea5e9"];
    B = day ? ["#a78bfa", "#f472b6", "#f59e0b"] : ["#f472b6", "#a78bfa", "#f59e0b"];
    oa = day ? 0.60 : 0.48;
    ob = day ? 0.40 : 0.32;
  }

  return { colorsA: A, colorsB: B, opacityA: oa, opacityB: ob };
}

function themeFrom(code?: number, isDay?: boolean): string {
  // Dark variant only applies when OS is dark
  const dark = "dark:from-slate-900 dark:via-indigo-950 dark:to-black";

  // Default light background
  let light = "from-slate-50 via-white to-slate-200";

  if (code != null) {
    const day = !!isDay;
    if ([0, 1, 2].includes(code)) {
      light = day ? "from-sky-50 via-blue-100 to-indigo-200" : "from-slate-50 via-indigo-50 to-blue-100";
    } else if (code === 3) {
      light = "from-slate-100 via-slate-200 to-slate-300";
    } else if ([45, 48].includes(code)) {
      light = "from-gray-100 via-gray-200 to-slate-200";
    } else if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) {
      light = "from-sky-50 via-sky-100 to-slate-200";
    } else if ([71,73,75,77,85,86].includes(code)) {
      light = "from-blue-50 via-slate-100 to-slate-200";
    } else if ([95,96,99].includes(code)) {
      light = "from-amber-50 via-sky-100 to-indigo-200";
    }
  }
  return `bg-gradient-to-br ${light} ${dark}`;
}

function weekday(dateIso: string) {
  const d = new Date(dateIso);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

// Format a daily date string ("YYYY-MM-DD") safely for a target timezone
function weekdayInTz(dateStr: string, tz: string) {
  // Use UTC noon to avoid date rollovers across time zones
  const d = new Date(`${dateStr}T12:00:00Z`);
  return new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: tz }).format(d);
}

// Helper to format a time in the location's time zone
function formatClock(iso: string, tz: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  }).format(d);
}

export default function Home() {
  const [city, setCity] = useState("");
  const [unit, setUnit] = useState<"metric" | "us">("us");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<{ id:string; headline:string; severity:string; uri:string|null }[]>([]);

  // Background + aurora
  const [themeClass, setThemeClass] = useState(() => themeFrom());
  const [aurora, setAurora] = useState<AuroraTheme>(() => auroraFrom());

  // Search + suggestions
  const [recent, setRecent] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);

  // Favorites / compare
  const [recentPlaces, setRecentPlaces] = useState<Place[]>([]);
  const [compareSel, setCompareSel] = useState<Place[]>([]);
  const [compareData, setCompareData] = useState<WeatherData[] | null>(null);

  // Map picker
  const [showMap, setShowMap] = useState(true);
  const [picked, setPicked] = useState<{ lat: number; lon: number } | null>(null);

  // Add to Home component state
  const [air, setAir] = useState<{ aqi:number|null; pm25:number|null; pm10:number|null } | null>(null);

  const labels = unitLabels(unit);
  const days = weather ? weather.daily.time.slice(0, 5).map((day, i) => ({ day, i })) : [];

  // Thermometer scale across the displayed 5 days
  const spanMin = weather ? Math.min(...weather.daily.temperature_2m_min.slice(0, 5)) : 0; // ADD
  const spanMax = weather ? Math.max(...weather.daily.temperature_2m_max.slice(0, 5)) : 1; // ADD

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

  // Load/save recent places (with coords)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("recentPlaces");
      if (raw) setRecentPlaces(JSON.parse(raw));
    } catch {}
  }, []);
  const pushRecentPlace = (p: Place) => {
    setRecentPlaces((prev) => {
      const dedup = prev.filter((x) => Math.abs(x.lat - p.lat) > 1e-6 || Math.abs(x.lon - p.lon) > 1e-6);
      const next = [p, ...dedup].slice(0, 8);
      localStorage.setItem("recentPlaces", JSON.stringify(next));
      return next;
    });
  };

  // When we load any weather, store as recent place
  useEffect(() => {
    if (weather?.location) {
      pushRecentPlace({ name: weather.location.name, lat: weather.location.lat, lon: weather.location.lon });
    }
  }, [weather?.location?.lat, weather?.location?.lon, weather?.location?.name]);

  // Update background when weather changes
  useEffect(() => {
    if (weather?.current) {
      setThemeClass(themeFrom(weather.current.weather_code, weather.current.is_day === 1));
    } else {
      setThemeClass(themeFrom());
    }
  }, [weather?.current?.weather_code, weather?.current?.is_day]);

  // Update aurora effect when weather changes
  useEffect(() => {
    if (weather?.current) {
      setAurora(auroraFrom(weather.current.weather_code, weather.current.is_day === 1));
    } else {
      setAurora(auroraFrom());
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

  // Restore last weather on first mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("lastWeather");
      if (raw) {
        const { data, unit: savedUnit } = JSON.parse(raw);
        if (savedUnit) setUnit(savedUnit);
        if (data) setWeather(data);
      }
    } catch {}
  }, []);

  // Persist whenever weather/unit change
  useEffect(() => {
    if (!weather) return;
    try {
      sessionStorage.setItem("lastWeather", JSON.stringify({ data: weather, unit }));
    } catch {}
  }, [weather, unit]);

  // If URL has lat/lon, load that location (used when returning from Day page)
  const sp = useSearchParams();
  useEffect(() => {
    const lat = Number(sp.get("lat"));
    const lon = Number(sp.get("lon"));
    const name = sp.get("name") || "Location";
    const urlUnit = (sp.get("unit") as "metric" | "us") || unit;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    // Avoid refetch if already showing same place/unit
    if (
      weather &&
      Math.abs(weather.location.lat - lat) < 1e-6 &&
      Math.abs(weather.location.lon - lon) < 1e-6 &&
      urlUnit === unit
    ) {
      return;
    }

    setUnit(urlUnit);
    setLoading(true);
    fetchWeather(lat, lon, name, urlUnit)
      .then(setWeather)
      .catch((e) => {
        console.error(e);
        setWeather(null);
      })
      .finally(() => setLoading(false));
  }, [sp]);

  // Compare handler
  async function doCompare() {
    if (compareSel.length !== 2) return;
    setLoading(true);
    try {
      const [a, b] = compareSel;
      const [wa, wb] = await Promise.all([
        fetchWeather(a.lat, a.lon, a.name, unit),
        fetchWeather(b.lat, b.lon, b.name, unit),
      ]);
      setCompareData([wa, wb]);
      queueMicrotask(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      console.error(e);
      setError("Compare failed. Try again.");
      setCompareData(null);
    } finally {
      setLoading(false);
    }
  }

  const handleMapPick = async (lat: number, lon: number) => {
    setPicked({ lat, lon });
    setLoading(true);
    setError(null);
    try {
      const name = (await reverseGeocode(lat, lon)) ?? "Selected location";
      const data = await fetchWeather(lat, lon, name, unit);
      setWeather(data);
      setCity("");
      queueMicrotask(() =>
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    } catch (e) {
      console.error(e);
      setError("Failed to load selected location.");
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = (p: Place) => {
    // Remove from favorites list + storage
    setRecentPlaces((prev) => {
      const next = prev.filter(
        (x) => Math.abs(x.lat - p.lat) >= 1e-6 || Math.abs(x.lon - p.lon) >= 1e-6
      );
      try { localStorage.setItem("recentPlaces", JSON.stringify(next)); } catch {}
      return next;
    });
    // If selected for compare, unselect it too
    setCompareSel((sel) =>
      sel.filter(
        (x) => Math.abs(x.lat - p.lat) >= 1e-6 || Math.abs(x.lon - p.lon) >= 1e-6
      )
    );
    setCompareData(null);
  };

  // Fetch alerts when weather is available
  useEffect(() => {
    if (!weather) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    fetch(`${base}/api/alerts?lat=${weather.location.lat}&lon=${weather.location.lon}`)
      .then((r) => r.json())
      .then((j) => setAlerts(j.alerts || []))
      .catch(() => setAlerts([]));
  }, [weather?.location.lat, weather?.location.lon]);

  // Add useEffect to fetch air quality
  useEffect(() => {
    if (!weather) return setAir(null);
    const base = typeof window !== "undefined" ? window.location.origin : "";
    fetch(`${base}/api/air?lat=${weather.location.lat}&lon=${weather.location.lon}`)
      .then(r => r.json())
      .then(setAir)
      .catch(() => setAir(null));
  }, [weather?.location.lat, weather?.location.lon]);

  return (
    <main className={`min-h-screen flex flex-col transition-colors duration-500 ${themeClass}`}>
      <Aurora {...aurora} />

      <div className="max-w-5xl w-full mx-auto px-6 py-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-center mb-2 gradient-text">
          Weather
        </h1>
        <p className="text-center opacity-80 mb-6">Search by city or use your location.</p>

        {/* Search + map */}
        <div className="max-w-3xl mx-auto mb-6 rounded-2xl ring-1 ring-black/10 dark:ring-white/15 bg-white/70 dark:bg-white/5 backdrop-blur p-4 sm:p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              goToCity();
            }}
          >
            <div className="flex gap-2 flex-wrap sm:flex-nowrap">
              <input
                ref={inputRef}
                type="text"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  if (!e.target.value.trim()) {
                    setShowSuggestions(false);
                    setSuggestions([]);
                    setFocusIdx(-1);
                  }
                }}
                onFocus={() => {
                  if (suggestions.length) setShowSuggestions(true);
                }}
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (focusIdx >= 0 && suggestions[focusIdx]) {
                      await chooseSuggestion(suggestions[focusIdx]);
                    } else {
                      await goToCity();
                    }
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    if (!suggestions.length) {
                      pendingArrowDownRef.current = true;
                      await goToCity();
                    } else {
                      setFocusIdx((i) => Math.min(i + 1, suggestions.length - 1));
                    }
                    setShowSuggestions(true);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setFocusIdx((i) => Math.max(i - 1, -1));
                  } else if (e.key === "Escape") {
                    setShowSuggestions(false);
                    setFocusIdx(-1);
                  }
                }}
                placeholder="Search a city (e.g., Seattle, WA)"
                className="min-w-0 flex-1 w-full rounded-xl px-4 py-3 ring-1 ring-black/15 dark:ring-white/20 bg-white/80 dark:bg-white/10 focus:outline-none focus:ring-sky-400/60"
              />
              <Button type="submit" variant="filled" size="md" disabled={loading} className="w-full sm:w-auto shrink-0">
                Search
              </Button>
              <Button type="button" variant="outline" size="md" onClick={useMyLocation} disabled={loading} className="w-full sm:w-auto shrink-0">
                Use my location
              </Button>
            </div>
          </form>

          {/* Unit switch + Map picker toggle */}
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <div className="inline-flex rounded-lg ring-1 ring-black/15 dark:ring-white/20 overflow-hidden">
              <button
                className={`px-3 py-1.5 text-sm ${unit === "us" ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-transparent"}`}
                onClick={() => switchUnit("us")}
                type="button"
              >
                US
              </button>
              <button
                className={`px-3 py-1.5 text-sm ${unit === "metric" ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "bg-transparent"}`}
                onClick={() => switchUnit("metric")}
                type="button"
              >
                Metric
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMap((v) => !v)}
              disabled={loading}
              className="ml-auto"
            >
              {showMap ? "Hide map" : "Pick on map"}
            </Button>
          </div>

          {/* Favorites: multi-select for comparison */}
          {recentPlaces.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm opacity-70">Favorites:</span>
              {recentPlaces.map((p) => {
                const isSelected = compareSel.some(
                  (c) => Math.abs(c.lat - p.lat) < 1e-6 && Math.abs(c.lon - p.lon) < 1e-6
                );
                const disabled = !isSelected && compareSel.length >= 2;

                const toggleSelect = () => {
                  setCompareData(null);
                  setCompareSel((sel) => {
                    const exists = sel.find(
                      (s) => Math.abs(s.lat - p.lat) < 1e-6 && Math.abs(s.lon - p.lon) < 1e-6
                    );
                    if (exists) {
                      // Unselect if already selected
                      return sel.filter(
                        (s) => !(Math.abs(s.lat - p.lat) < 1e-6 && Math.abs(s.lon - p.lon) < 1e-6)
                      );
                    }
                    if (sel.length >= 2) return sel;
                    return [...sel, p];
                  });
                };

                return (
                  <div
                    key={`${p.lat},${p.lon}`}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    aria-pressed={isSelected}
                    aria-disabled={disabled || undefined}
                    className={`group relative pl-3 pr-2 py-1.5 rounded-xl text-sm ring-1 transition ${
                      isSelected
                        ? "bg-sky-600 text-white ring-sky-600"
                        : "bg-white/70 dark:bg-white/10 ring-black/10 dark:ring-white/15 hover:bg-black/5 dark:hover:bg-white/15"
                    } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    onClick={() => {
                      if (disabled) return;
                      toggleSelect();
                    }}
                    onKeyDown={(e) => {
                      if (disabled) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSelect();
                      }
                    }}
                    title={p.name}
                  >
                    <span className="truncate max-w-[10rem] inline-block align-middle">{p.name}</span>

                    {/* Close: remove from favorites; visible on hover/focus/when selected */}
                    <button
                      type="button"
                      aria-label={`Remove ${p.name} from favorites`}
                      title="Remove"
                      className={`ml-2 inline-flex items-center justify-center w-5 h-5 rounded-md transition
                        ${isSelected ? "opacity-100" : "opacity-0"}
                        group-hover:opacity-100 group-focus-within:opacity-100
                        ${isSelected ? "bg-white/25 text-white/95 hover:bg-white/35" : "bg-black/10 text-black/70 hover:bg-black/15 dark:bg-white/15 dark:text-white/80 dark:hover:bg-white/25"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFavorite(p);
                      }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}

              <Button
                variant="outline"
                size="sm"
                className="ml-1"
                onClick={doCompare}
                disabled={compareSel.length !== 2 || loading}
              >
                Compare
              </Button>
            </div>
          )}

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="mt-2 rounded-xl ring-1 ring-black/10 dark:ring-white/15 bg-white/90 dark:bg-gray-900/80 backdrop-blur shadow-lg overflow-hidden"
            >
              {suggestions.map((s, i) => {
                const active = i === focusIdx;
                return (
                  <button
                    key={`${s.latitude},${s.longitude},${s.name}`}
                    className={`w-full text-left px-4 py-2 text-sm ${active ? "bg-black/5 dark:bg-white/10" : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault(); // keep focus
                      chooseSuggestion(s);
                    }}
                  >
                    {formatPlace(s)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Map picker */}
          {showMap && (
            <div className="mt-3">
              <MapPicker
                initial={{
                  lat: weather?.location.lat ?? 39.5,
                  lon: weather?.location.lon ?? -98.35,
                }}
                onChange={handleMapPick}
                radar={true}
                animateRadar={true}
                showRadarControls={true}
                radarStepMs={800}
              />
            </div>
          )}
        </div>

        {!loading && weather && (
          <section ref={resultsRef} className="mb-10">
            <div className="grid gap-4 md:grid-cols-5 items-stretch">
              <Card accent="amber" tilt>
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between">
                    <div className="text-sm uppercase tracking-wider opacity-80">Temp</div>
                    <WeatherIcons
                      code={weather.current.weather_code}
                      isDay={weather.current.is_day === 1}
                      size={22}
                      className="text-amber-500 dark:text-amber-300"
                    />
                  </div>
                  <div className="mt-1 text-4xl font-semibold">
                    {Math.round(weather.current.temperature_2m)}{labels.temp}
                  </div>
                  {(() => {
                    const startIdx = Math.max(weather.hourly.time.findIndex((t) => t >= weather.current.time), 0);
                    const temps = weather.hourly.temperature_2m.slice(startIdx, startIdx + 24);
                    return temps.length > 1 ? (
                      <div className="mt-auto pt-4">
                        <Sparkline data={temps} height={42} />
                      </div>
                    ) : null;
                  })()}
                </div>
              </Card>

              <Card accent="rose" tilt>
                <div className="flex h-full flex-col">
                  <div className="text-sm uppercase tracking-wider opacity-80">Feels like</div>
                  <div className="mt-1 text-4xl font-semibold">
                    {Math.round(weather.current.apparent_temperature)}{labels.temp}
                  </div>
                  {(() => {
                    const startIdx = Math.max(weather.hourly.time.findIndex((t) => t >= weather.current.time), 0);
                    const feels = weather.hourly.apparent_temperature.slice(startIdx, startIdx + 24);
                    return feels.length > 1 ? (
                      <div className="mt-auto pt-4 text-rose-500 dark:text-rose-300">
                        <Sparkline data={feels} height={42} />
                      </div>
                    ) : null;
                  })()}
                </div>
              </Card>

              <Card accent="emerald" tilt>
                <div className="flex h-full flex-col">
                  <div className="text-sm uppercase tracking-wider opacity-80">Wind</div>
                  <div className="mt-1 text-4xl font-semibold">
                    {Math.round(weather.current.wind_speed_10m)} {labels.wind}
                  </div>
                  {(() => {
                    const startIdx = Math.max(weather.hourly.time.findIndex((t) => t >= weather.current.time), 0);
                    const wind = weather.hourly.wind_speed_10m.slice(startIdx, startIdx + 24);
                    return wind.length > 1 ? (
                      <div className="mt-auto pt-4 text-emerald-600 dark:text-emerald-300">
                        <Sparkline data={wind} height={42} />
                      </div>
                    ) : null;
                  })()}
                </div>
              </Card>

              <Card accent="sky" tilt>
                <div className="flex h-full flex-col">
                  <div className="text-sm uppercase tracking-wider opacity-80">Precip</div>
                  <div className="mt-1 text-4xl font-semibold">
                    {formatPrecip(Number(weather.current.precipitation || 0), unit)} {labels.precip}
                  </div>
                  {(() => {
                    const startIdx = Math.max(weather.hourly.time.findIndex((t) => t >= weather.current.time), 0);
                    const precip = weather.hourly.precipitation.slice(startIdx, startIdx + 24);
                    return precip.length > 1 ? (
                      <div className="mt-auto pt-4 text-sky-700 dark:text-sky-300">
                        <Sparkline data={precip} height={42} />
                      </div>
                    ) : null;
                  })()}
                </div>
              </Card>

              {/* Add Air Quality card */}
              <Card accent="indigo" tilt>
                <div className="flex h-full flex-col">
                  <div className="text-sm uppercase tracking-wider opacity-80">Air Quality</div>
                  <div className="mt-1 text-4xl font-semibold">
                    {air?.aqi != null ? Math.round(air.aqi) : "–"}
                  </div>
                  <div className="text-sm opacity-80">
                    {air?.aqi != null ? (
                      air.aqi <= 50 ? "Good" :
                      air.aqi <= 100 ? "Moderate" :
                      air.aqi <= 150 ? "Unhealthy for Sensitive" :
                      air.aqi <= 200 ? "Unhealthy" : "Hazardous"
                    ) : "AQI"}
                  </div>
                  <div className="opacity-80 mt-auto pt-4 text-sm">
                    PM2.5 {air?.pm25?.toFixed?.(1) ?? "–"} • PM10 {air?.pm10?.toFixed?.(1) ?? "–"}
                  </div>
                </div>
              </Card>
            </div>
          </section>
        )}

        {/* 5‑day forecast */}
        {loading && (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-fade-up" style={{ animationDelay: `${80 * i}ms` }}>
                <div className="p-3 rounded-2xl ring-1 ring-black/10 dark:ring-white/10 bg-white/70 dark:bg-white/5">
                  <div className="skeleton h-5 w-20 mb-2" />
                  <div className="skeleton h-8 w-16 mb-1" />
                  <div className="skeleton h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && weather && (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
            {days.map(({ day, i }, idx) => {
              const href =
                `/day/${day}?lat=${weather.location.lat}&lon=${weather.location.lon}` +
                `&unit=${unit}&name=${encodeURIComponent(weather.location.name)}&tz=${encodeURIComponent(weather.timezone)}`;
              const lo = weather.daily.temperature_2m_min[i];     // ADD
              const hi = weather.daily.temperature_2m_max[i];     // ADD
              const span = Math.max(1, spanMax - spanMin);         // ADD
              const start = ((lo - spanMin) / span) * 100;         // ADD
              const width = (Math.max(hi - lo, 0) / span) * 100;   // ADD

              return (
                <Link key={day} href={href} prefetch className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 rounded-2xl">
                  <Card padding="p-3" wrapperClassName="animate-fade-up">
                    <div style={{ animationDelay: `${80 * idx}ms` }}>
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{i === 0 ? "Today" : weekdayInTz(day, weather.timezone)}</div>
                        <WeatherIcons
                          code={weather.daily.weather_code?.[i] ?? weather.current.weather_code}
                          isDay
                          size={22}
                          className="text-slate-700 dark:text-slate-200"
                        />
                      </div>
                      <div className="text-2xl font-semibold mt-1">
                        {Math.round(hi)}{labels.temp}
                      </div>
                      <div className="text-sm opacity-80">
                        Low: {Math.round(lo)}{labels.temp}
                      </div>

                      {/* Hi/Lo thermometer bar */}
                      <div className="mt-2 h-1.5 rounded-full bg-black/10 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-amber-500 dark:bg-amber-400"
                          style={{ marginLeft: `${start}%`, width: `${width}%` }}
                        />
                      </div>

                      {Number.isFinite(weather.daily.precipitation_probability_max?.[i]) && (
                        <div className="text-xs opacity-70 mt-2">
                          Precip chance: {Math.round(weather.daily.precipitation_probability_max![i])}%
                        </div>
                      )}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        {!loading && !weather && (
          <div className="text-center opacity-75 mt-6">Search to see the 5‑day forecast.</div>
        )}

        {compareData && compareData.length === 2 && (
          <section className="mt-10" ref={resultsRef}>
            <h3 className="text-lg font-semibold mb-3">Comparison</h3>
            <div className="grid gap-4 md:grid-cols-2 items-stretch">
              {compareData.map((w) => {
                const labelsC = unitLabels(unit);
                const startIdx = Math.max(w.hourly.time.findIndex((t) => t >= w.current.time), 0);
                const temps = w.hourly.temperature_2m.slice(startIdx, startIdx + 24);
                const feels = w.hourly.apparent_temperature.slice(startIdx, startIdx + 24);
                const wind = w.hourly.wind_speed_10m.slice(startIdx, startIdx + 24);
                const precip = w.hourly.precipitation.slice(startIdx, startIdx + 24);
                return (
                  <Card key={`${w.location.lat},${w.location.lon}`} wrapperClassName="animate-fade-up">
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="text-xl font-semibold">{w.location.name}</div>
                      <div className="text-sm opacity-80">
                        {new Date(w.current.time).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone: w.timezone,
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm opacity-80 mb-1">Temp</div>
                        <div className="text-3xl font-semibold">
                          {Math.round(w.current.temperature_2m)}
                          {labelsC.temp}
                        </div>
                        {temps.length > 1 && <div className="mt-2"><Sparkline data={temps} height={36} /></div>}
                      </div>
                      <div>
                        <div className="text-sm opacity-80 mb-1">Feels</div>
                        <div className="text-3xl font-semibold">
                          {Math.round(w.current.apparent_temperature)}
                          {labelsC.temp}
                        </div>
                        {feels.length > 1 && (
                          <div className="mt-2 text-rose-500 dark:text-rose-300">
                            <Sparkline data={feels} height={36} />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-sm opacity-80 mb-1">Wind</div>
                        <div className="text-3xl font-semibold">
                          {Math.round(w.current.wind_speed_10m)} {labelsC.wind}
                        </div>
                        {wind.length > 1 && (
                          <div className="mt-2 text-emerald-600 dark:text-emerald-300">
                            <Sparkline data={wind} height={36} />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-sm opacity-80 mb-1">Precip</div>
                        <div className="text-3xl font-semibold">
                          {(precip?.[0] || 0).toFixed(unit === "us" ? 2 : 1)} {labelsC.precip}
                        </div>
                        {precip.length > 1 && (
                          <div className="mt-2 text-sky-700 dark:text-sky-300">
                            <Sparkline data={precip} height={36} />
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {alerts.length > 0 && (
          <div className="mb-4 rounded-xl p-3 ring-1 ring-amber-500/30 bg-amber-400/15 text-amber-900 dark:text-amber-200">
            <div className="font-semibold mb-1">Weather alerts</div>
            <ul className="list-disc pl-5 space-y-1">
              {alerts.slice(0, 3).map((a) => (
                <li key={a.id}>
                  {a.headline}
                  {a.uri && (
                    <Link className="ml-2 underline" href={a.uri} target="_blank" rel="noreferrer">
                      Details
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Sunrise/Sunset section */}
        {!loading && weather && (
          <section className="mt-4">
            <div className="grid">
              <Card accent="indigo" tilt>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" role="img" aria-label="sunrise">🌅</span>
                    <div>
                      <div className="text-sm uppercase tracking-wider opacity-80">Sunrise</div>
                      <div className="text-xl font-semibold">
                        {weather.daily.sunrise?.[0]
                          ? formatClock(weather.daily.sunrise[0], weather.timezone)
                          : "–"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-2xl" role="img" aria-label="sunset">🌇</span>
                    <div>
                      <div className="text-sm uppercase tracking-wider opacity-80">Sunset</div>
                      <div className="text-xl font-semibold">
                        {weather.daily.sunset?.[0]
                          ? formatClock(weather.daily.sunset[0], weather.timezone)
                          : "–"}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm opacity-80 sm:text-right">
                    {(() => {
                      const sr = weather.daily.sunrise?.[0];
                      const ss = weather.daily.sunset?.[0];
                      if (!sr || !ss) return null;
                      const srDate = new Date(sr);
                      const ssDate = new Date(ss);
                      const dayMinutes = Math.max(0, Math.round((ssDate.getTime() - srDate.getTime()) / 60000));
                      const h = Math.floor(dayMinutes / 60);
                      const m = dayMinutes % 60;
                      // Simple golden hour approximation (±1h around sunrise/sunset)
                      const gh1Start = new Date(srDate.getTime());
                      const gh1End = new Date(srDate.getTime() + 60 * 60000);
                      const gh2Start = new Date(ssDate.getTime() - 60 * 60000);
                      const gh2End = new Date(ssDate.getTime());
                      const tz = weather.timezone;

                      return (
                        <>
                          <div>Daylight: {h}h {m}m</div>
                          <div className="mt-1">
                            Golden hour: {formatClock(gh1Start.toISOString(), tz)}–{formatClock(gh1End.toISOString(), tz)} and {formatClock(gh2Start.toISOString(), tz)}–{formatClock(gh2End.toISOString(), tz)}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </Card>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}