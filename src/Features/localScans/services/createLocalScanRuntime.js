// Decoded scans shared by the Scan 3D tool and the scan base maps, kept
// outside React so they survive the tool drawer, the 2D view and any
// component remount. One entry per resource and load zone; references are
// counted and an unreferenced entry is dropped after a delay (a quick
// close / reopen or a base map reload reuses it).
//
// decode(resource, {signal, onProgress}) → Promise<{data, source}>
// Pure module (node tests): the app instance lives in localScanRuntime.js.
export default function createLocalScanRuntime(
  decode,
  { evictionDelayMs = 15000 } = {}
) {
  const entries = new Map();

  const keyOf = (resource) =>
    `${resource.id}|${JSON.stringify(resource.scan?.zone ?? null)}`;

  function drop(entry) {
    if (entries.get(entry.key) !== entry) return;
    entries.delete(entry.key);
    entry.controller.abort();
  }

  function hold(entry, onProgress) {
    clearTimeout(entry.timer);
    entry.refs++;
    if (onProgress) entry.listeners.add(onProgress);
    let released = false;
    return {
      promise: entry.promise,
      release() {
        if (released) return;
        released = true;
        if (onProgress) entry.listeners.delete(onProgress);
        if (--entry.refs > 0) return;
        entry.timer = setTimeout(() => {
          if (!entry.refs) drop(entry);
        }, evictionDelayMs);
      },
    };
  }

  function create(key, start) {
    const entry = {
      key,
      refs: 0,
      timer: null,
      controller: new AbortController(),
      listeners: new Set(),
    };
    entry.promise = start(entry);
    // A failed decode is never cached: the next acquire retries.
    entry.promise.catch(() => drop(entry));
    entries.set(key, entry);
    return entry;
  }

  return {
    // → {promise, release}
    acquire(resource, { onProgress } = {}) {
      const key = keyOf(resource);
      const entry =
        entries.get(key) ??
        create(key, (created) =>
          decode(resource, {
            signal: created.controller.signal,
            onProgress: (ratio) =>
              created.listeners.forEach((listener) => listener(ratio)),
          })
        );
      return hold(entry, onProgress);
    },
    // A scan decoded elsewhere (load through the zone dialog) joins the
    // cache under its saved zone.
    seed(resource, value) {
      const key = keyOf(resource);
      const previous = entries.get(key);
      if (previous && !previous.refs) drop(previous);
      const entry =
        entries.get(key) ?? create(key, () => Promise.resolve(value));
      return hold(entry);
    },
    has(resource) {
      return entries.has(keyOf(resource));
    },
  };
}
