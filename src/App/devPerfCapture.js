// DEV-ONLY perf capture for the issue #290 measurements. Survives page
// reloads (installed at boot). Exposes on window:
// - __perfLog:  last 600 console lines containing [debug_perf], timestamped
// - __dbWaves:  timestamps of Dexie 'storagemutated' events (one per
//               committed top-level transaction = one liveQuery re-run wave)
// Remove this file (and its import in main.jsx) once the perf work is done.
import Dexie from "dexie";

if (import.meta.env.DEV && !window.__perfCaptureInstalled) {
  window.__perfCaptureInstalled = true;
  window.__perfLog = [];
  window.__dbWaves = [];

  const orig = console.log.bind(console);
  console.log = (...args) => {
    try {
      const s = String(args[0]);
      if (s.includes("[debug_perf]")) {
        window.__perfLog.push({
          t: Math.round(performance.now()),
          msg: args
            .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
            .join(" ")
            .slice(0, 320),
        });
        if (window.__perfLog.length > 600) window.__perfLog.shift();
      }
    } catch {
      /* never break logging */
    }
    orig(...args);
  };

  try {
    Dexie.on("storagemutated", (parts) => {
      window.__dbWaves.push({
        t: Math.round(performance.now()),
        tables: Object.keys(parts || {})
          .map((k) => k.split("/").pop())
          .join(","),
      });
      if (window.__dbWaves.length > 200) window.__dbWaves.shift();
    });
  } catch {
    /* best effort */
  }
}
