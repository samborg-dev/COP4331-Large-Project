import { useEffect, useMemo, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { createLandscapeLoader } from "./landscapeTiles";
import type { Guess } from "../round";
import { countryKey, guessColor, withRevealedAnswer } from "./countryHighlights";
type CountryCollection = Extract<import("maplibre-gl").GeoJSONSourceSpecification["data"], { type: "FeatureCollection" }>;

export function GameGlobe({ guesses = [], focusCountry, answer, gameId }: { guesses?: Guess[]; focusCountry?: { name: string; requestId: string }; answer?: string; gameId?: string }) {
  const highlights = useMemo(() => withRevealedAnswer(guesses, answer), [guesses, answer]);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const latestGuesses = useRef(highlights);
  const coloredCountries = useRef(new Set<string>());
  const countryShapes = useRef<CountryCollection>({ type: "FeatureCollection", features: [] });
  const centers = useRef(new Map<string, [number, number]>());
  const pendingFocus = useRef<typeof focusCountry>(undefined);
  const previousGameId = useRef(gameId);
  const [message, setMessage] = useState("Loading globe…");
  useEffect(() => {
    const previous = previousGameId.current;
    previousGameId.current = gameId;
    if (!previous || !gameId || previous === gameId) return;
    pendingFocus.current = undefined;
    const map = mapRef.current;
    map?.stop();
    map?.jumpTo({ center: [0, 20], zoom: 1.8, bearing: 0, pitch: 0 });
  }, [gameId]);
  function focusGuess() {
    const map = mapRef.current;
    const request = pendingFocus.current;
    if (!map || !request) return;
    const center = centers.current.get(countryKey(request.name));
    if (!center) return;
    pendingFocus.current = undefined;
    // Choose the nearest longitude copy instead of spinning around the world.
    const longitude = center[0] + 360 * Math.round((map.getCenter().lng - center[0]) / 360);
    map.stop();
    map.easeTo({ center: [longitude, center[1]], zoom: Math.max(map.getZoom(), 3),
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1100 });
  }
  useEffect(() => {
    pendingFocus.current = focusCountry;
    focusGuess();
  }, [focusCountry]);
  function updateHighlights(map: import("maplibre-gl").Map, next: Guess[]) {
    const source = map.getSource("game-countries") as import("maplibre-gl").GeoJSONSource | undefined;
    if (!source) return;
    const keys = new Set(next.map(guess => countryKey(guess.name)));
    source.setData({ type: "FeatureCollection", features: countryShapes.current.features
      .filter((feature: CountryCollection["features"][number]) => keys.has(String(feature.properties?.countryKey))) });
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
    const labelSource = map.getSource("guessed-country-labels") as import("maplibre-gl").GeoJSONSource | undefined;
    labelSource?.setData({ type: "FeatureCollection", features: next.flatMap((guess) => {
      const point = centers.current.get(countryKey(guess.name));
      return point ? [{ type: "Feature" as const, properties: { name: guess.name },
        geometry: { type: "Point" as const, coordinates: point } }] : [];
    }) });
  }
  useEffect(() => {
    latestGuesses.current = highlights;
    if (mapRef.current) updateHighlights(mapRef.current, highlights);
  }, [highlights]);
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
            const [response, centerResponse] = await Promise.all([
              fetch(`${import.meta.env.BASE_URL}data/countries.geojson`, { signal: controller.signal }),
              fetch(`${import.meta.env.BASE_URL}data/country-centers.json`, { signal: controller.signal }),
            ]);
            if (!response.ok) throw new Error("Country shapes could not load.");
            const data: CountryCollection = await response.json();
            if (centerResponse.ok) {
              const targets: Record<string, [number, number]> = await centerResponse.json();
              centers.current = new globalThis.Map(Object.entries(targets).map(([name, point]) => [countryKey(name), point]));
            }
            for (const feature of data.features) {
              feature.properties = { ...feature.properties, countryKey: countryKey(String(feature.properties?.name ?? "")) };
            }
            if (disposed) return;
            countryShapes.current = data;
            map.addSource("game-countries", { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "countryKey" });
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
            map.addSource("guessed-country-labels", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
            map.addLayer({ id: "guessed-country-names", type: "symbol", source: "guessed-country-labels", layout: {
              "text-field": ["get", "name"],
              "text-font": ["Noto Sans Regular"],
              "text-size": ["interpolate", ["linear"], ["zoom"], 0, 11, 5, 13, 9, 15],
              "text-max-width": 10,
              "text-allow-overlap": true,
              "text-ignore-placement": true,
              "text-pitch-alignment": "viewport",
              "text-rotation-alignment": "viewport",
            }, paint: { "text-color": "#f5f7fb", "text-halo-color": "#10141f", "text-halo-width": 1.8 } });
            updateHighlights(map, latestGuesses.current);
            focusGuess();
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
