export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    if (!lat || !lon) return NextResponse.json({ aqi: null });

    const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
    url.searchParams.set("latitude", lat);
    url.searchParams.set("longitude", lon);
    url.searchParams.set("hourly", "us_aqi,pm2_5,pm10,european_aqi");
    url.searchParams.set("timezone", "auto");

    const r = await fetch(url.toString(), { cache: "no-store" });
    if (!r.ok) {
      console.error(`Air quality API error: ${r.status}`);
      return NextResponse.json({ aqi: null });
    }

    const j = await r.json();
    console.log("Air quality response:", j); // Debug log

    const aqi = j.hourly?.us_aqi?.[0] ?? null;
    const pm25 = j.hourly?.pm2_5?.[0] ?? null;
    const pm10 = j.hourly?.pm10?.[0] ?? null;

    return NextResponse.json({ aqi, pm25, pm10 });
  } catch (error) {
    console.error("Air quality fetch error:", error);
    return NextResponse.json({ aqi: null }, { status: 200 });
  }
}