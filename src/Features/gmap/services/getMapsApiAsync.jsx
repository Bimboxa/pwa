// The Maps JavaScript API key comes from appConfig (features.gmap.jsApiKey).
// It is intentionally a browser key (restricted by HTTP referrer in GCP) — do
// not hardcode it here.

// Memoized per-key promise so concurrent callers (e.g. React 19 StrictMode
// double-invoke of effects) share a single <script> injection. Loading the
// Maps JS API twice triggers misleading errors like ApiNotActivatedMapError.
const inflight = new Map();

function getMapsApiAsync(apiKey) {
  if (window.google && window.google.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (!apiKey) {
    return Promise.reject(
      new Error(
        "[getMapsApiAsync] Missing Maps JS API key (appConfig.features.gmap.jsApiKey)"
      )
    );
  }

  const cached = inflight.get(apiKey);
  if (cached) return cached;

  const promise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(
      `script[src^="https://maps.googleapis.com/maps/api/js?key=${apiKey}"]`
    );
    if (existingScript) {
      if (window.google?.maps?.Map) {
        resolve(window.google.maps);
      } else {
        existingScript.addEventListener("load", () =>
          resolve(window.google.maps)
        );
        existingScript.addEventListener("error", reject);
      }
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => {
      console.log("GMAP LOADED");
      resolve(window.google.maps);
    };
    script.onerror = (err) => {
      inflight.delete(apiKey);
      reject(err);
    };
    document.body.appendChild(script);
  });

  inflight.set(apiKey, promise);
  return promise;
}

export default getMapsApiAsync;
