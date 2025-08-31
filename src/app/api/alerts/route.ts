export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const lang = searchParams.get("lang") || "en";
    if (!lat || !lon) return NextResponse.json({ alerts: []});

    const url = new URL("https://api.open-meteo.com/v1/warnings");
    url.searchParams.set("latitude", lat);
    url.searchParams.set("longitude", lon);
    url.searchParams.set("language", lang);

    const r = await fetch(url.toString(), { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    // Normalize
    const alerts = (j?.warnings || []).map((w: any) => ({
      id: w.id ?? `${w.event}-${w.severity}-${w.start}`,
      event: w.event,
      severity: w.severity,          // Minor/Moderate/Severe/Extreme
      start: w.start,
      end: w.end,
      headline: w.headline || w.event,
      description: w.description || "",
      sender: w.sender ?? "",
      uri: w.uri ?? null,
    }));
    return  NextResponse.json({ alerts });
  } catch {
    return NextResponse.json({ alerts: []}, { status: 200 });
  }
}
