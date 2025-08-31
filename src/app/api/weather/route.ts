export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const unit = searchParams.get("unit") === "metric" ? "metric" : "us";

    const latNum = Number(lat);
    const lonNum = Number(lon);
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum) || Math.abs(latNum) > 90 || Math.abs(lonNum) > 180) {
      return NextResponse.json({ error: "invalid_lat_lon", lat, lon }, { status: 400 });
    }

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(latNum));
    url.searchParams.set("longitude", String(lonNum));
    url.searchParams.set(
      "current",
      "is_day,temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m"
    );
    url.searchParams.set(
      "daily",
      "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code,sunrise,sunset"
    );
    url.searchParams.set("hourly", "temperature_2m,apparent_temperature,wind_speed_10m,precipitation");
    url.searchParams.set("timezone", "auto");

    // Remove params that conflict with explicit date range
    // url.searchParams.set("forecast_days", "7"); // REMOVE
    url.searchParams.delete("past_days");         // ensure it's not present

    // Use an explicit 7‑day window starting today
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 6);
    const startDateStr = today.toISOString().slice(0, 10);
    const endDateStr = endDate.toISOString().slice(0, 10);
    url.searchParams.set("start_date", startDateStr);
    url.searchParams.set("end_date", endDateStr);

    if (unit === "us") {
      url.searchParams.set("temperature_unit", "fahrenheit");
      url.searchParams.set("wind_speed_unit", "mph");
      url.searchParams.set("precipitation_unit", "inch");
    } else {
      url.searchParams.set("temperature_unit", "celsius");
      url.searchParams.set("wind_speed_unit", "kmh");
      url.searchParams.set("precipitation_unit", "mm");
    }

    const upstream = await fetch(url.toString(), { cache: "no-store" });
    const text = await upstream.text();

    if (!upstream.ok) {
      return NextResponse.json(
        { error: "upstream_error", status: upstream.status, url: url.toString(), body: text },
        { status: upstream.status }
      );
    }

    return new NextResponse(text, {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}