// Recolor the public Natural Earth relief tiles without changing elevation data.
async function renderTile({ url }: { url: string }, controller: AbortController) {
  const response = await fetch(url.replace("landscape://", "https://"), { signal: controller.signal });
  if (!response.ok) throw new Error("Land detail could not load.");
  const image = await createImageBitmap(await response.blob());
  const canvas = new OffscreenCanvas(image.width, image.height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) { image.close(); throw new Error("Map color rendering is unavailable."); }
  context.drawImage(image, 0, 0);
  image.close();
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
  for (let i = 0; i < pixels.data.length; i += 4) {
    const r = pixels.data[i] / 255, g = pixels.data[i + 1] / 255, b = pixels.data[i + 2] / 255;
    let color: number[];
    if (b > r * 1.08 && b > g) color = [20, 44, 72];
    else {
      // Preserve variations in the source land cover, with continuous transitions.
      const vegetation = smooth((g - r + 0.025) / 0.125);
      const dry = [r * 145, g * 137, b * 113];
      const green = [r * 65, g * 114, b * 72];
      const snow = smooth((Math.min(r, g, b) - 0.85) / 0.13)
        * (1 - smooth((Math.max(r, g, b) - Math.min(r, g, b) - 0.04) / 0.06));
      color = dry.map((value, channel) => {
        const land = value * (1 - vegetation) + green[channel] * vegetation;
        return land * (1 - snow) + [154, 169, 175][channel] * snow;
      });
    }
    pixels.data[i] = color[0];
    pixels.data[i + 1] = color[1];
    pixels.data[i + 2] = color[2];
  }
  context.putImageData(pixels, 0, 0);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
  return { data: await blob.arrayBuffer() };
}

const jobs = new Map<number, AbortController>();
const cache = new Map<string, ArrayBuffer>();
self.onmessage = async ({ data }: MessageEvent<{ id: number; url?: string; cancel?: boolean }>) => {
  if (data.cancel) { jobs.get(data.id)?.abort(); return; }
  const url = data.url!;
  const controller = new AbortController();
  jobs.set(data.id, controller);
  try {
    let tile = cache.get(url);
    if (!tile) {
      tile = (await renderTile({ url }, controller)).data;
      cache.set(url, tile);
      if (cache.size > 96) cache.delete(cache.keys().next().value!);
    } else { cache.delete(url); cache.set(url, tile); }
    if (!controller.signal.aborted) {
      const copy = tile.slice(0);
      self.postMessage({ id: data.id, tile: copy }, { transfer: [copy] });
    }
  } catch (error) {
    self.postMessage({ id: data.id, error: error instanceof Error ? error.message : "Map tile failed." });
  } finally { jobs.delete(data.id); }
};
export {};
