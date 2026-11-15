import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { createLandscapeLoader } from "./landscapeTiles";

export function GameGlobe() {
  const container = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("Loading globe…");
  useEffect(() => {
    let disposed = false;
    let map: import("maplibre-gl").Map | undefined;
    let observer: ResizeObserver | undefined;
    let landscape: ReturnType<typeof createLandscapeLoader> | undefined;
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
        map.on("load", () => { if (!disposed) setMessage(""); });
        map.on("error", () => { if (!disposed && !map?.areTilesLoaded()) setMessage("Some map detail could not load. Check your connection."); });
        map.on("idle", () => { if (!disposed) setMessage(""); });
        observer = new ResizeObserver(() => map?.resize());
        observer.observe(container.current);
      } catch {
        if (!disposed) setMessage("The globe needs WebGL enabled in your browser. You can still use country search.");
      }
    }).catch(() => { if (!disposed) setMessage("The globe could not load. Refresh to try again."); });
    return () => { disposed = true; observer?.disconnect(); map?.remove(); landscape?.dispose(); };
  }, []);
  return (
    <div className="game-globe">
      <div className="globe-map" ref={container} aria-label="World map. Drag to move; scroll or pinch to zoom." />
      {message && <p className="globe-message" role="status">{message}</p>}
    </div>
  );
}
