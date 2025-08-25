export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    if (!lat || !lon) {
      return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
    }

    const url = new URL("https://geocoding-api.open-meteo.com/v1/reverse");
    url.searchParams.set("latitude", lat);
    url.searchParams.set("longitude", lon);
    url.searchParams.set("language", "en");
    url.searchParams.set("count", "1");

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ name: null }, { status: 200 });

    const data = await res.json();
    const first = data?.results?.[0];
    const name = first ? [first.name, first.admin1, first.country].filter(Boolean).join(", ") : null;

    return NextResponse.json({ name });
  } catch {
    return NextResponse.json({ name: null }, { status: 200 });
  }
}