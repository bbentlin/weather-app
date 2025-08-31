"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";

type Props = {
  initial: { lat: number; lon: number };
  onChange: (lat: number, lon: number) => void;
  height?: number;
  radar?: boolean;
  animateRadar?: boolean;
  radarOpacity?: number;
  radarStepMs?: number;       // frame duration
  showRadarControls?: boolean;
  showLayerControls?: boolean; // ADD: show Leaflet layer switcher
};

type Frame = { time: number; path: string };

export default function MapPicker({
  initial,
  onChange,
  height = 360,
  radar = true,
  animateRadar = true,
  radarOpacity = 0.7,
  radarStepMs = 800,
  showRadarControls = true,
  showLayerControls = true, // ADD
}: Props) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const radarLayerRef = useRef<any>(null);
  const framesRef = useRef<Frame[]>([]);
  const layersCtrlRef = useRef<any>(null); // ADD
  const timerRef = useRef<any>(null);
  const radarGroupRef = useRef<any>(null);        // ADD: toggle overlay
  const radarLayersRef = useRef<any[]>([]);       // ADD: one layer per frame
  const radarLoadedRef = useRef<boolean[]>([]);   // ADD: loaded flags

  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(animateRadar);

  const setRadarUrl = useCallback((L: any, url: string) => {
    if (!mapRef.current) return;
    if (radarLayerRef.current) {
      radarLayerRef.current.setUrl(url);
      return;
    }
    const layer = L.tileLayer(url, {
      opacity: radarOpacity,
      zIndex: 400,
      crossOrigin: true as any,
    });
    layer.addTo(mapRef.current);
    radarLayerRef.current = layer;
  }, [radarOpacity]);

  const urlForPath = (path: string) =>
    `https://tilecache.rainviewer.com/v2/radar/${path}/512/{z}/{x}/{y}/2/1_1.png`;

  // Cross-fade to a frame if loaded; otherwise do nothing (will render once loaded)
  const showFrame = useCallback((idx: number) => {
    const layers = radarLayersRef.current;
    if (!layers.length) return;
    const clamped = Math.max(0, Math.min(idx, layers.length - 1));
    // Hide all others, show selected
    layers.forEach((lyr, i) => {
      try {
        lyr.setOpacity(i === clamped ? (typeof lyr._targetOpacity === "number" ? lyr._targetOpacity : 0.7) : 0);
        if (i === clamped) lyr.bringToFront?.();
      } catch {}
    });
  }, []);

  useEffect(() => {
    let L: any;
    let cancelled = false;

    // Ensure the container is pristine before L.map()
    const resetContainer = () => {
      const el = mapElRef.current as any;
      if (!el) return;
      // Remove Leaflet's internal id and children
      try {
        el.replaceChildren(); // clears inner HTML
      } catch {
        el.innerHTML = "";
      }
      if (el._leaflet_id) {
        try {
          delete el._leaflet_id;
        } catch {
          // fallback: recreate the node (rarely needed)
          const parent = el.parentElement;
          if (parent) {
            const fresh = el.cloneNode(false) as HTMLElement;
            parent.replaceChild(fresh, el);
            // reattach ref
            // @ts-ignore
            mapElRef.current = fresh;
          }
        }
      }
    };

    (async () => {
      const mod = await import("leaflet");
      if (cancelled) return;
      L = mod.default || mod;

      // Make sure container is clean before mapping
      resetContainer();
      const container = mapElRef.current!;
      if (!container) return;

      const icon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });

      // Base maps
      const streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      });
      const satellite = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            "Tiles &copy; Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
          maxZoom: 19,
        }
      );
      const topo = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
        attribution: "Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)",
        maxZoom: 17,
      });
      const baseLayers: Record<string, any> = {
        "Streets (OSM)": streets,
        "Satellite (Esri)": satellite,
        "Topographic (OTM)": topo,
      };

      // Init map (after resetContainer)
      const map = L.map(container, {
        center: [initial.lat, initial.lon],
        zoom: 6,
        zoomControl: true,
        preferCanvas: false,
        fadeAnimation: true,
        zoomAnimation: true,
        updateWhenIdle: true,
        keepBuffer: 4,
      });
      if (cancelled) {
        try { map.remove(); } catch {}
        return;
      }
      mapRef.current = map;
      streets.addTo(map);

      // Layer control
      if (showLayerControls) {
        const ctrl = L.control.layers(baseLayers, {}, { collapsed: false, position: "topright" });
        ctrl.addTo(map);
        layersCtrlRef.current = ctrl;
      }

      // Build radar stack
      if (radar) {
        try {
          const res = await fetch("https://api.rainviewer.com/public/weather-maps.json", { cache: "no-store" });
          if (cancelled) return;
          if (res.ok) {
            const j = await res.json();
            const past: Frame[] = (j?.radar?.past ?? []).slice(-6);
            const nowcast: Frame[] = j?.radar?.nowcast ?? [];
            const frames: Frame[] = [...past, ...nowcast];
            framesRef.current = frames;

            // Cleanup previous group/layers if any
            radarGroupRef.current?.remove?.();
            radarLayersRef.current.forEach((lyr) => lyr.remove?.());
            radarLayersRef.current = [];
            radarLoadedRef.current = [];

            // Create a layer group to toggle as one overlay
            const group = L.layerGroup([]);
            radarGroupRef.current = group;
            group.addTo(map);
            if (layersCtrlRef.current) {
              layersCtrlRef.current.addOverlay(group, "Radar");
            }

            // Create one tile layer per frame (hidden), add to group, preload
            frames.forEach((f, i) => {
              const tl = L.tileLayer(urlForPath(f.path), {
                opacity: 0,
                zIndex: 400 + i,
                crossOrigin: true as any,
              });
              // @ts-ignore
              tl._targetOpacity = radarOpacity;
              let pending = 0;
              tl.on("loading", () => { pending++; });
              tl.on("load", () => {
                pending = Math.max(0, pending - 1);
                if (pending === 0) radarLoadedRef.current[i] = true;
              });

              tl.addTo(group);
              radarLayersRef.current.push(tl);
              radarLoadedRef.current.push(false);
            });

            const last = Math.max(frames.length - 1, 0);
            setFrameIdx(last);
            showFrame(last);
          } else {
            // Fallback: single latest tile layer
            const tl = L.tileLayer(
              "https://tilecache.rainviewer.com/v2/radar/nowcast_0/512/{z}/{x}/{y}/2/1_1.png",
              { opacity: radarOpacity, zIndex: 450, crossOrigin: true as any }
            );
            tl.addTo(map);
            radarGroupRef.current = L.layerGroup([tl]).addTo(map);
            if (layersCtrlRef.current) layersCtrlRef.current.addOverlay(radarGroupRef.current, "Radar");
            radarLayersRef.current = [tl];
            radarLoadedRef.current = [true];
            framesRef.current = [];
          }
        } catch {
          if (cancelled || !mapRef.current) return;
          const tl = L.tileLayer(
            "https://tilecache.rainviewer.com/v2/radar/nowcast_0/512/{z}/{x}/{y}/2/1_1.png",
            { opacity: radarOpacity, zIndex: 450, crossOrigin: true as any }
          );
          tl.addTo(mapRef.current);
          radarGroupRef.current = L.layerGroup([tl]).addTo(mapRef.current);
          if (layersCtrlRef.current) layersCtrlRef.current.addOverlay(radarGroupRef.current, "Radar");
          radarLayersRef.current = [tl];
          radarLoadedRef.current = [true];
          framesRef.current = [];
        }
      }

      // Marker
      const marker = L.marker([initial.lat, initial.lon], { draggable: true, icon }).addTo(map);
      markerRef.current = marker;
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng();
        onChange(lat, lng);
      });
      map.on("click", (e: any) => {
        marker.setLatLng(e.latlng);
        onChange(e.latlng.lat, e.latlng.lng);
      });
    })();

    return () => {
      cancelled = true;
      try {
        clearInterval(timerRef.current);
        radarGroupRef.current?.remove?.();
        radarLayersRef.current.forEach((lyr) => lyr.remove?.());
        radarLayersRef.current = [];
        radarLoadedRef.current = [];
        layersCtrlRef.current?.remove?.();
        markerRef.current = null;
        if (mapRef.current) {
          mapRef.current.off();
          mapRef.current.remove();
          mapRef.current = null;
        }
        // Clean container so next init doesn't throw
        const el = mapElRef.current as any;
        if (el) {
          try { el.replaceChildren(); } catch { el.innerHTML = ""; }
          try { delete el._leaflet_id; } catch {}
        }
      } catch {}
    };
  }, [initial.lat, initial.lon, onChange, radar, radarOpacity, showLayerControls, showFrame]);

  // Drive animation (skip to next loaded frame)
  useEffect(() => {
    if (!radar || !animateRadar) return;
    clearInterval(timerRef.current);
    if (!playing) return;

    const tick = () => {
      const layers = radarLayersRef.current;
      if (!layers.length) return;

      let next = (frameIdx + 1) % layers.length;
      // If next frame not yet loaded, try to skip forward up to N frames
      const N = layers.length;
      let tries = 0;
      while (tries < N && !radarLoadedRef.current[next]) {
        next = (next + 1) % layers.length;
        tries++;
      }
      setFrameIdx(next);
      showFrame(next);
    };

    timerRef.current = setInterval(tick, Math.max(200, radarStepMs));
    return () => clearInterval(timerRef.current);
  }, [radar, animateRadar, radarStepMs, playing, frameIdx, showFrame]);

  // Scrub handler
  const onScrub = (idx: number) => {
    setFrameIdx(idx);
    showFrame(idx);
  };

  // Format frame time label in user's local time zone
  const frameTimeLabel = (() => {
    const frames = framesRef.current;
    if (!frames.length) return "Radar";
    const t = frames[frameIdx]?.time;
    if (!t) return "Radar";
    try {
      const d = new Date(t * 1000);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Example: "3:45 PM PDT" (locale-aware)
      return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
        timeZone: tz,
        timeZoneName: "short",
      }).format(d);
    } catch {
      return "Radar";
    }
  })();

  return (
    <div
      style={{ height }}
      className="relative rounded-2xl overflow-hidden ring-1 ring-black/10 dark:ring-white/10"
    >
      {/* Leaflet owns this element; do not render React children inside it */}
      <div ref={mapElRef} className="absolute inset-0 z-0" />

      {radar && showRadarControls && (
        <div className="absolute left-2 right-2 bottom-2 sm:left-3 sm:right-3 sm:bottom-3 z-[1001] pointer-events-none">
          <div className="flex items-center gap-2 rounded-xl px-2 py-1.5 bg-white/80 dark:bg-black/60 backdrop-blur ring-1 ring-black/10 dark:ring-white/15 pointer-events-auto">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="px-2 py-1 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15"
              title={playing ? "Pause" : "Play"}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(framesRef.current.length - 1, 0)}
              step={1}
              value={Math.min(frameIdx, Math.max(framesRef.current.length - 1, 0))}
              onChange={(e) => onScrub(Number(e.target.value))}
              className="flex-1 accent-sky-600"
            />
            <span className="text-xs tabular-nums opacity-80 min-w-[64px] text-right">{frameTimeLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
}