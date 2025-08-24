"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [city, setCity] = useState("");

  const goToCity = () => {
    const q = city.trim();
    if (!q) return;
    router.push(`/weather?city=${encodeURIComponent(q)}`);
  };

  const resolveByIP = async () => {
    try {
      const res = await fetch("https://ipapi.co/json/");
      if (!res.ok) throw new Error("IP lookup failed");
      const j = await res.json();
      const { latitude, longitude } = j;
      if (typeof latitude === "number" && typeof longitude === "number") {
        router.push(`/weather?lat=${latitude}&lon=${longitude}`);
        return true;
      }
    } catch {}
    return false;
  };

  const useMyLocation = async () => {
    try {
      // Check permission state (Edge/macOS often ends up “denied”)
      const perm = await (navigator.permissions?.query as any)?.({ name: "geolocation" as any }).catch(() => null);
      if (perm?.state === "denied") {
        const ok = await resolveByIP();
        if (!ok) alert("Location permission denied. Enable it in the browser settings, or enter a city.");
        return;
      }

      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      }).then((pos) => {
        const { latitude, longitude } = pos.coords;
        router.push(`/weather?lat=${latitude}&lon=${longitude}`);
      }).catch(async (err: GeolocationPositionError) => {
        // 1: denied, 2: unavailable, 3: timeout
        console.warn("Geolocation error:", err.code, err.message);
        const ok = await resolveByIP();
        if (!ok) {
          alert(
            err.code === 1
              ? "Location permission denied. Allow it in the site permissions."
              : err.code === 2
              ? "Location unavailable. Try again later or enter a city."
              : "Location request timed out. Try again or enter a city."
          );
        }
      });
    } catch {
      const ok = await resolveByIP();
      if (!ok) alert("Unable to get your location.");
    }
  };

  return (
    <main className="min-h-screen flex flex-col">
      <section className="flex-1 max-w-3xl mx-auto px-6 pt-24 pb-6 text-center">
        <h1 className="text-5xl font-extrabold tracking-tight mb-3">Weather at a glance</h1>
        <p className="text-lg opacity-90 mb-8">Search by city or use your current location.</p>

        <div className="flex flex-wrap justify-center items-center gap-3 mb-2">
          <input
            className="w-[min(520px,90vw)] rounded-xl px-4 py-3 text-gray-300 placeholder-gray-300 outline-none"
            type="text"
            placeholder="Enter city (e.g., Seattle)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && goToCity()}
            aria-label="City"
          />
          <button
            className="rounded-xl px-4 py-3 bg-gray-900 text-white font-semibold hover:bg-gray-800 transition"
            onClick={goToCity}
          >
            Get Weather
          </button>
        </div>

        <button
          className="mt-2 rounded-xl px-4 py-2 border border-white/25 text-white hover:bg-white/10 backdrop-blur-sm transition"
          onClick={useMyLocation}
        >
          Use my location
        </button>
      </section>

      <footer className="p-4 text-center opacity-80 text-sm">
        © {new Date().getFullYear()} Weather App
      </footer>
    </main>
  );
}