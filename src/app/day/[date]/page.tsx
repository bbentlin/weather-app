"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Card from "@/components/Card";
import Sparkline from "@/components/Sparkline";
import Button from "@/components/Button";
import { Fragment } from "react";
import WeatherIcons from "@/components/WeatherIcons";

type Unit = "metric" | "us";

type HourlyData = {
  time: string[];
  temperature_2m: number[];
  apparent_temperature: number[];
  relative_humidity_2m: number[];
  dew_point_2m: number[];
  precipitation: number[];
  precipitation_probability: number[];
  weather_code: number[];
  cloud_cover: number[];
  wind_speed_10m: number[];
  wind_gusts_10m: number[];
  pressure_msl: number[];
  uv_index: number[];
  visibility: number[];
};

type DailyData = {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum?: number[];
  precipitation_probability_max?: number[];
  sunrise?: string[];
  sunset?: string[];
};

type DayBundle = {
  timezone: string;
  hourly: HourlyData;
  daily: DailyData;
};

function unitLabels(unit: Unit) {
  return {
    temp: unit === "us" ? "°F" : "°C",
    wind: unit === "us" ? "mph" : "kmh",
    precip: unit === "us" ? "in" : "mm",
  };
}

async function fetchDay(lat: number, lon: number, unit: Unit, tz?: string): Promise<DayBundle> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("timezone", tz || "auto");
  url.searchParams.set(
    "hourly",
    [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "dew_point_2m",
      "precipitation",
      "precipitation_probability",
      "weather_code",
      "cloud_cover",
      "wind_speed_10m",
      "wind_gusts_10m",
      "pressure_msl",
      "uv_index",
      "visibility",
    ].join(",")
  );
  url.searchParams.set(
    "daily",
    [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "sunrise",
      "sunset",
    ].join(",")
  );
  url.searchParams.set("forecast_days", "7");
  if (unit === "us") {
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("wind_speed_unit", "mph");
    url.searchParams.set("precipitation_unit", "inch");
  } else {
    url.searchParams.set("temperature_unit", "celsius");
    url.searchParams.set("wind_speed_unit", "kmh");
    url.searchParams.set("precipitation_unit", "mm");
  }

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load day data");
  const data = await res.json();
  return { timezone: data.timezone, hourly: data.hourly, daily: data.daily };
}

export default function DayPage() {
  const { date } = useParams<{ date: string }>();
  const sp = useSearchParams();
  const router = useRouter();

  const lat = Number(sp.get("lat"));
  const lon = Number(sp.get("lon"));
  const name = sp.get("name") || "Location";
  const unit = (sp.get("unit") as Unit) || "us";
  const tz = sp.get("tz") || undefined;

  const labels = unitLabels(unit);
  const [loading, setLoading] = useState(true);
  const [bundle, setBundle] = useState<DayBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hourIdx, setHourIdx] = useState(0); // ADD

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !date) {
      setError("Invalid parameters.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchDay(lat, lon, unit, tz)
      .then((b) => {
        if (!cancelled) {
          setBundle(b);
          setError(null);
        }
      })
      .catch(() => !cancelled && setError("Failed to load data"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [lat, lon, unit, tz, date]);

  // After data loads, default selection (now if today, else midday)
  useEffect(() => {
    if (!bundle) return;
    const times = bundle.hourly.time;

    // Compute start/end indices for this date
    const s = times.findIndex((t) => t.slice(0, 10) === date);
    if (s < 0) return;
    let e = s;
    while (e < times.length && times[e].slice(0, 10) === date) e++;
    if (s === e) return;

    const dayTimes = times.slice(s, e);
    const todayISO = new Date().toISOString().slice(0, 10);
    const tzId = tz || bundle.timezone;
    let idx = Math.min(12, dayTimes.length - 1);

    if (date === todayISO) {
      const now = new Date();
      // Robust: extract just the hour number (0-23) for the given timezone
      const parts = new Intl.DateTimeFormat(undefined, {
        timeZone: tzId,
        hour: "numeric",
        hourCycle: "h23",
      }).formatToParts(now);
      const hourPart = parts.find((p) => p.type === "hour");
      const nowHour = hourPart ? parseInt(hourPart.value, 10) : NaN;
      if (Number.isFinite(nowHour)) {
        idx = Math.max(0, Math.min(dayTimes.length - 1, nowHour));
      }
    }

    // Final guard
    if (!Number.isFinite(idx)) idx = 0;
    setHourIdx(idx);
  }, [bundle, date, tz]);

  const fmtDate = useMemo(() => {
    try {
      const d = new Date(date + "T12:00:00");
      return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: tz || bundle?.timezone }).format(d);
    } catch {
      return date;
    }
  }, [date, tz, bundle?.timezone]);

  const dayIdxRange = useMemo(() => {
    if (!bundle) return { start: 0, end: 0 };
    const times = bundle.hourly.time;
    const s = times.findIndex((t) => t.slice(0, 10) === date);
    if (s < 0) return { start: 0, end: 0 };
    let e = s;
    while (e < times.length && times[e].slice(0, 10) === date) e++;
    return { start: s, end: e };
  }, [bundle, date]);

  const slice = <T,>(arr: T[]) => arr.slice(dayIdxRange.start, dayIdxRange.end);

  const timesOfDay = useMemo(() => {
    if (!bundle) return [];
    const { start, end } = dayIdxRange;
    return bundle.hourly.time.slice(start, end);
  }, [bundle, dayIdxRange]);

  const at = <T,>(arr: T[], fallback?: T) => {
    const len = timesOfDay.length;
    if (!len) return fallback!;
    const safeHour = Number.isFinite(hourIdx) ? hourIdx : 0;
    const idx = dayIdxRange.start + Math.min(Math.max(safeHour, 0), len - 1);
    return arr[idx] ?? fallback!;
  };

  const timeLabel = useMemo(() => {
    if (!timesOfDay.length) return "";
    const idx = Math.min(Math.max(hourIdx, 0), timesOfDay.length - 1);
    const t = timesOfDay[idx];
    if (typeof t !== "string") return "";
    // Expect "YYYY-MM-DDTHH:mm" – extract HH safely
    const m = t.match(/T(\d{2}):/);
    if (!m) return t.slice(11, 16) || "";
    const h = Number(m[1]);
    if (!Number.isFinite(h)) return "";
    const hour12 = (h % 12) || 12;
    const ampm = h < 12 ? "AM" : "PM";
    return `${hour12} ${ampm}`;
  }, [timesOfDay, hourIdx]);

  // Simple helpers
  const maxOf = (arr: number[]) => (arr.length ? Math.max(...arr) : NaN);
  const minOf = (arr: number[]) => (arr.length ? Math.min(...arr) : NaN);
  const round = (n: number, d = 0) => (Number.isFinite(n) ? Number(n.toFixed(d)) : NaN);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-200 dark:from-slate-900 dark:via-slate-950 dark:to-black">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{name}</h1>
            <div className="opacity-80">{fmtDate}</div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams();
              params.set("lat", String(lat));
              params.set("lon", String(lon));
              params.set("unit", unit);
              if (name) params.set("name", name);
              if (tz) params.set("tz", String(tz));
              router.push(`/?${params.toString()}`);
            }}
          >
            Back
          </Button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-500/15 border border-red-500/30 p-3">{error}</div>
        )}

        {loading && (
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}>
                <div className="h-10 w-24 bg-black/10 dark:bg-white/20 rounded animate-pulse mb-2" />
                <div className="h-4 w-40 bg-black/10 dark:bg-white/20 rounded animate-pulse" />
              </Card>
            ))}
          </div>
        )}

        {bundle && !loading && (
          <>
            {/* Hour slider */}
            {bundle && timesOfDay.length > 1 && (
              <div className="mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-sm opacity-80 min-w-[60px]">Hour: {timeLabel}</div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(timesOfDay.length - 1, 0)}
                    step={1}
                    value={
                      (() => {
                        const maxIdx = Math.max(timesOfDay.length - 1, 0);
                        const hv = Number.isFinite(hourIdx) ? hourIdx : 0;
                        return Math.min(Math.max(hv, 0), maxIdx);
                      })()
                    }
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setHourIdx(Number.isFinite(n) ? n : 0);
                    }}
                    className="w-full accent-sky-600"
                  />
                </div>
              </div>
            )}

            {/* Summary cards */}
            <div className="grid gap-4 md:grid-cols-4 items-stretch auto-rows-fr">
              {/* Temperature */}
              <Card accent="amber" tilt wrapperClassName="animate-fade-up">
                <div style={{ animationDelay: "60ms" }}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm uppercase tracking-wider opacity-80">Temperature</div>
                    <WeatherIcons code={bundle.hourly.weather_code?.[dayIdxRange.start] ?? 1} isDay size={22} className="text-amber-500 dark:text-amber-300" />
                  </div>
                  <div className="flex h-full flex-col">
                    <div>
                      <div className="text-4xl font-semibold">
                        {Math.round(at(bundle.hourly.temperature_2m) as number)}{labels.temp}
                      </div>
                      <div className="opacity-80">at {timeLabel}</div>
                    </div>
                    <div className="mt-auto pt-4">
                      <div className="text-xs uppercase opacity-70 mb-1">Hourly</div>
                      <Sparkline data={slice(bundle.hourly.temperature_2m)} height={42} />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Feels like */}
              <Card accent="rose" tilt>
                <div className="flex h-full flex-col">
                  <div>
                    <div className="text-sm uppercase tracking-wider opacity-80 mb-1">Feels like</div>
                    <div className="text-4xl font-semibold">
                      {Math.round(at(bundle.hourly.apparent_temperature) as number)}{labels.temp}
                    </div>
                    <div className="opacity-80">at {timeLabel}</div>
                  </div>
                  <div className="mt-auto pt-4 text-rose-500 dark:text-rose-300">
                    <div className="text-xs uppercase opacity-70 mb-1 text-inherit">Hourly</div>
                    <Sparkline data={slice(bundle.hourly.apparent_temperature)} height={42} />
                  </div>
                </div>
              </Card>

              {/* Wind */}
              <Card accent="emerald" tilt>
                <div className="flex h-full flex-col">
                  <div>
                    <div className="text-sm uppercase tracking-wider opacity-80 mb-1">Wind</div>
                    <div className="text-4xl font-semibold">
                      {Math.round(at(bundle.hourly.wind_speed_10m) as number)} {labels.wind}
                    </div>
                    <div className="opacity-80">gust {Math.round(at(bundle.hourly.wind_gusts_10m) as number)} {labels.wind}</div>
                  </div>
                  <div className="mt-auto pt-4 text-emerald-600 dark:text-emerald-300">
                    <div className="text-xs uppercase opacity-70 mb-1 text-inherit">Hourly</div>
                    <Sparkline data={slice(bundle.hourly.wind_speed_10m)} height={42} />
                  </div>
                </div>
              </Card>

              {/* Precipitation */}
              <Card accent="sky" tilt>
                <div className="flex h-full flex-col">
                  <div>
                    <div className="text-sm uppercase tracking-wider opacity-80 mb-1">Precipitation</div>
                    <div className="text-4xl font-semibold">
                      {(Number(at(bundle.hourly.precipitation) || 0)).toFixed(unit === "us" ? 2 : 1)} {labels.precip}
                    </div>
                    <div className="opacity-80">chance {Math.round(Number(at(bundle.hourly.precipitation_probability) || 0))}% at {timeLabel}</div>
                  </div>
                  <div className="mt-auto pt-4 text-sky-700 dark:text-sky-300">
                    <div className="text-xs uppercase opacity-70 mb-1 text-inherit">Hourly</div>
                    <Sparkline data={slice(bundle.hourly.precipitation)} height={42} />
                  </div>
                </div>
              </Card>
            </div>

            {/* Extra metrics */}
            <div className="grid gap-4 md:grid-cols-3 mt-6">
              {/* Humidity */}
              <Card>
                <div className="flex h-full flex-col">
                  <div>
                    <div className="text-sm uppercase tracking-wider opacity-80 mb-1">Humidity</div>
                    {(() => {
                      const vals = slice(bundle.hourly.relative_humidity_2m);
                      const avg = Math.round(
                        vals.reduce((a, b) => a + (b ?? 0), 0) / (vals.length || 1)
                      );
                      return (
                        <div className="text-3xl font-semibold">
                          {Number.isFinite(avg) ? `${avg}%` : "–"}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="mt-auto pt-4">
                    <Sparkline data={slice(bundle.hourly.relative_humidity_2m)} height={48} />
                  </div>
                </div>
              </Card>

              {/* Cloud cover */}
              <Card>
                <div className="flex h-full flex-col">
                  <div>
                    <div className="text-sm uppercase tracking-wider opacity-80 mb-1">Cloud cover</div>
                    {(() => {
                      const vals = slice(bundle.hourly.cloud_cover);
                      const avg = Math.round(
                        vals.reduce((a, b) => a + (b ?? 0), 0) / (vals.length || 1)
                      );
                      return (
                        <div className="text-3xl font-semibold">
                          {Number.isFinite(avg) ? `${avg}%` : "–"}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="mt-auto pt-4">
                    <Sparkline data={slice(bundle.hourly.cloud_cover)} height={48} />
                  </div>
                </div>
              </Card>

              {/* UV index */}
              <Card>
                <div className="flex h-full flex-col">
                  <div>
                    <div className="text-sm uppercase tracking-wider opacity-80 mb-1">UV index</div>
                    {(() => {
                      const vals = slice(bundle.hourly.uv_index);
                      const max = round(maxOf(vals));
                      return (
                        <div className="text-3xl font-semibold">
                          {Number.isFinite(max) ? max : "–"}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="mt-auto pt-4">
                    <Sparkline data={slice(bundle.hourly.uv_index)} height={48} />
                  </div>
                </div>
              </Card>
            </div>

            {/* Hourly list */}
            <div className="mt-8">
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">Hourly details</h2>
                </div>

                {(() => {
                  const times = slice(bundle.hourly.time);
                  const temps = slice(bundle.hourly.temperature_2m);
                  const feels = slice(bundle.hourly.apparent_temperature);
                  const wind = slice(bundle.hourly.wind_speed_10m);
                  const gust = slice(bundle.hourly.wind_gusts_10m);
                  const precip = slice(bundle.hourly.precipitation);
                  const chance = slice(bundle.hourly.precipitation_probability);

                  if (!times.length) return <div className="opacity-70">No hourly data.</div>;

                  return (
                    <div className="overflow-auto max-h-[60vh] rounded-xl ring-1 ring-black/5 dark:ring-white/10">
                      <table className="min-w-[720px] w-full text-sm">
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-white/80 dark:bg-white/10 backdrop-blur supports-[backdrop-filter:blur(0)]:bg-white/60">
                            <th className="text-left px-3 py-2 font-semibold">Time</th>
                            <th className="text-left px-3 py-2 font-semibold">Temp</th>
                            <th className="text-left px-3 py-2 font-semibold">Feels</th>
                            <th className="text-left px-3 py-2 font-semibold">Wind</th>
                            <th className="text-left px-3 py-2 font-semibold">Precip</th>
                            <th className="text-left px-3 py-2 font-semibold">Chance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {times.map((t, i) => {
                            // Safe, cross-browser hour label from string
                            const tp = (t.split("T")[1] || "");
                            const [hStr] = tp.split(":");
                            const hNum = Number(hStr);
                            const label =
                              Number.isFinite(hNum)
                                ? `${((hNum % 12) || 12)} ${hNum < 12 ? "AM" : "PM"}`
                                : (t.slice(11, 16) || "");

                            const trClass =
                              i % 2 === 0
                                ? "bg-black/0 dark:bg-white/0"
                                : "bg-black/[0.03] dark:bg-white/[0.04]";

                            const windTxt = `${Math.round(wind[i] || 0)} ${labels.wind}`;
                            const gustTxt = `${Math.round(gust[i] || 0)} ${labels.wind}`;
                            const precipTxt =
                              (precip[i] || 0).toFixed(unit === "us" ? 2 : 1) + " " + labels.precip;
                            const pct = Math.max(0, Math.min(100, Math.round(chance[i] || 0)));

                            return (
                              <tr
                                key={t}
                                className={`${trClass} border-b border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 transition-colors`}
                              >
                                <td className="px-3 py-2 whitespace-nowrap font-medium">{label}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {Math.round(temps[i])}
                                  {labels.temp}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {Math.round(feels[i])}
                                  {labels.temp}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <div className="flex items-baseline gap-2">
                                    <span className="font-medium">{windTxt}</span>
                                    <span className="opacity-70 text-xs">gust {gustTxt}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">{precipTxt}</td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2 min-w-[130px]">
                                    <div className="w-20 h-1.5 rounded-full bg-sky-200/70 dark:bg-sky-900/40 overflow-hidden">
                                      <div
                                        className="h-full bg-sky-600/80 dark:bg-sky-400/90"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <span className="tabular-nums">{pct}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </Card>
            </div>
          </>
        )}
      </div>
    </main>
  );
}