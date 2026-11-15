import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { createLandscapeLoader } from "./landscapeTiles";
import type { Guess } from "../round";
import { countryKey, guessColor } from "./countryHighlights";
type CountryCollection = Extract<import("maplibre-gl").GeoJSONSourceSpecification["data"], { type: "FeatureCollection" }>;

export function GameGlobe({ guesses = [] }: { guesses?: Guess[] }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const latestGuesses = useRef(guesses);
  const coloredCountries = useRef(new Set<string>());
  const [message, setMessage] = useState("Loading globe…");
  function updateHighlights(map: import("maplibre-gl").Map, next: Guess[]) {
    if (!map.getSource("game-countries")) return;
    for (const id of coloredCountries.current) map.removeFeatureState({ source: "game-countries", id });
    coloredCountries.current.clear();
    for (const guess of next) {
      const id = countryKey(guess.name);
      map.setFeatureState({ source: "game-countries", id }, { color: guessColor(guess), guessed: true });
      coloredCountries.current.add(id);
    }
    if (map.getLayer("raised-guessed-countries")) {
      map.setFilter("raised-guessed-countries", ["in", ["get", "countryKey"], ["literal", [...coloredCountries.current]]]);
    }

  }
  useEffect(() => {
    latestGuesses.current = guesses;
    if (mapRef.current) updateHighlights(mapRef.current, guesses);
  }, [guesses]);
  useEffect(() => {
    let disposed = false;
    let map: import("maplibre-gl").Map | undefined;
    let observer: ResizeObserver | undefined;
    let landscape: ReturnType<typeof createLandscapeLoader> | undefined;
    const controller = new AbortController();
    const colored = coloredCountries.current;
    if (typeof WebGL2RenderingContext === "undefined") return;
    import("maplibre-gl").then(({ Map, setWorkerUrl, addProtocol }) => {
      if (disposed || !container.current) return;
      try {
        setWorkerUrl(workerUrl);
        landscape = createLandscapeLoader();
        addProtocol("landscape", landscape.load);
        map = new Map({
          container: container.current,
          style: `${import.meta.env.BASE_URL}data/globe-style.json`,
          transformRequest: (url) => ({ url: url === "/data/landscape-fallback.png"
            ? new URL(`${import.meta.env.BASE_URL}data/landscape-fallback.png`, window.location.href).href : url }),
          center: [0, 20], zoom: 1.8, minZoom: 0.5, maxZoom: 9, maxPitch: 0,
          pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
          maxTileCacheZoomLevels: 8,
          canvasContextAttributes: { antialias: true, powerPreference: "high-performance" },
          attributionControl: { compact: true },
        });
        mapRef.current = map;
        map.once("style.load", async () => {
          if (disposed || !map) return;
          setMessage("");
          try {
            const response = await fetch(`${import.meta.env.BASE_URL}data/countries.geojson`, { signal: controller.signal });
            if (!response.ok) throw new Error("Country shapes could not load.");
            const data: CountryCollection = await response.json();
            for (const feature of data.features) {
              feature.properties = { ...feature.properties, countryKey: countryKey(String(feature.properties?.name ?? "")) };
            }
            if (disposed) return;
            map.addSource("game-countries", { type: "geojson", data, promoteId: "countryKey" });
            map.addLayer({ id: "guessed-countries", type: "fill", source: "game-countries", paint: {
              "fill-color": ["coalesce", ["feature-state", "color"], "#000000"],
              "fill-opacity": ["case", ["boolean", ["feature-state", "guessed"], false], 0.55, 0],
            } });
            map.addLayer({ id: "raised-guessed-countries", type: "fill-extrusion", source: "game-countries",
              filter: ["in", ["get", "countryKey"], ["literal", []]], paint: {
                "fill-extrusion-color": ["coalesce", ["feature-state", "color"], "#000000"],
                "fill-extrusion-height": ["interpolate", ["exponential", 2], ["zoom"], 0, 40000, 3, 18000, 6, 2000, 9, 250],
                "fill-extrusion-base": 0,
                "fill-extrusion-opacity": 0.55,
                "fill-extrusion-vertical-gradient": true,
              },
            });
            map.addLayer({ id: "guessed-country-outlines", type: "line", source: "game-countries", paint: {
              "line-color": "#171b20",
              "line-opacity": ["case", ["boolean", ["feature-state", "guessed"], false], 1, 0],
              "line-width": ["interpolate", ["linear"], ["zoom"], 0, 1.2, 4, 1.6, 9, 2],
            } });
            updateHighlights(map, latestGuesses.current);
          } catch {
            if (!disposed) setMessage("Country highlights could not load. Refresh to try again.");
          }
        });
        map.on("error", () => { if (!disposed && !map?.areTilesLoaded()) setMessage("Some map detail could not load. Check your connection."); });
        map.on("idle", () => { if (!disposed) setMessage(""); });
        observer = new ResizeObserver(() => map?.resize());
        observer.observe(container.current);
      } catch {
        if (!disposed) setMessage("The globe needs WebGL enabled in your browser. You can still use country search.");
      }
    }).catch(() => { if (!disposed) setMessage("The globe could not load. Refresh to try again."); });
    return () => { disposed = true; controller.abort(); mapRef.current = null; colored.clear(); observer?.disconnect(); map?.remove(); landscape?.dispose(); };
  }, []);
  return (
    <div className="game-globe">
      <div className="globe-map" ref={container} aria-label="World map. Drag to move; scroll or pinch to zoom." />
      {message && <p className="globe-message" role="status">{message}</p>}
    </div>
  );
}
