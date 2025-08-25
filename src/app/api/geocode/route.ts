export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const count = parseInt(searchParams.get("count") || "10", 10);
    const lang = searchParams.get("lang") || "en";
    if (!q) return NextResponse.json({ results: [] });

    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.searchParams.set("name", q);
    url.searchParams.set("count", String(Math.min(Math.max(count, 1), 20)));
    url.searchParams.set("language", lang);
    url.searchParams.set("format", "json");
    
    const upstream = await fetch(url.toString(), { cache: "no-store" });
    const data = await upstream.json().catch(() => ({} as any));
    const results = (data?.results || []).map((r: any) => ({
      name: r.name,
      admin1: r.admin1,
      country: r.country,
      latitude: r.latitude,
      longitude: r.longitude,
      population: r.population ?? null,
      timezone: r.timezone ?? null,
    }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] }, { status: 200 });
  }
}