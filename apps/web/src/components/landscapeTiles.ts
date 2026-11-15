import LandscapeWorker from "./landscape.worker?worker";

// Decode and recolor tiles off the thread that handles dragging and zooming.
export function createLandscapeLoader() {
  const worker = new LandscapeWorker();
  let sequence = 0;
  const pending = new Map<number, { resolve: (value: { data: ArrayBuffer }) => void; reject: (error: Error) => void; cleanup: () => void }>();
  worker.onmessage = ({ data }: MessageEvent<{ id: number; tile?: ArrayBuffer; error?: string }>) => {
    const job = pending.get(data.id);
    if (!job) return;
    pending.delete(data.id);
    job.cleanup();
    if (data.tile) job.resolve({ data: data.tile });
    else job.reject(new Error(data.error || "Map tile failed."));
  };
  worker.onerror = () => {
    for (const job of pending.values()) { job.cleanup(); job.reject(new Error("Map color worker failed.")); }
    pending.clear();
  };
  return {
    load: ({ url }: { url: string }, controller: AbortController) => new Promise<{ data: ArrayBuffer }>((resolve, reject) => {
      if (controller.signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
      const id = ++sequence;
      const abort = () => {
        worker.postMessage({ id, cancel: true });
        pending.delete(id);
        reject(new DOMException("Aborted", "AbortError"));
      };
      controller.signal.addEventListener("abort", abort, { once: true });
      pending.set(id, { resolve, reject, cleanup: () => controller.signal.removeEventListener("abort", abort) });
      worker.postMessage({ id, url });
    }),
    dispose: () => {
      worker.terminate();
      for (const job of pending.values()) { job.cleanup(); job.reject(new DOMException("Aborted", "AbortError")); }
      pending.clear();
    },
  };
}
