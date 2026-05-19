// The Maps JavaScript API key comes from appConfig (features.gmap.jsApiKey).
// It is intentionally a browser key (restricted by HTTP referrer in GCP) — do
// not hardcode it here.

async function getMapsApiAsync(apiKey) {
  if (window.google && window.google.maps) {
    return window.google.maps;
  }

  if (!apiKey) {
    throw new Error(
      "[getMapsApiAsync] Missing Maps JS API key (appConfig.features.gmap.jsApiKey)"
    );
  }

  return new Promise((resolve, reject) => {
    // Check if the script is already present in the document
    const existingScript = document.querySelector(
      `script[src^="https://maps.googleapis.com/maps/api/js?key=${apiKey}"]`
    );
    if (existingScript) {
      if (existingScript.hasAttribute("data-gmap-loaded")) {
        // Script already loaded
        resolve(window.google.maps);
      } else {
        // Wait for the script to load
        existingScript.addEventListener("load", () => {
          resolve(window.google.maps);
        });
        existingScript.addEventListener("error", reject);
      }
    } else {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.loading = "async";
      script.onload = () => {
        script.setAttribute("data-gmap-loaded", "true");
        setTimeout(() => {
          console.log("GMAP LOADED");
          resolve(window.google.maps);
        }, 100);
      };
      script.onerror = reject;
      document.body.appendChild(script);
    }
  });
}

export default getMapsApiAsync;
