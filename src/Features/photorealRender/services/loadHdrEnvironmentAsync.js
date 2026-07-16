import { EquirectangularReflectionMapping } from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

// One promise per HDR url, cached for the app session.
const cachedPromises = new Map();

// Loads an HDR environment used by the PHOTOREAL render mode (served from
// public/photoreal/env/, stable URLs, deliberately NOT precached by the PWA
// service worker — online-only). The resolved equirect texture works both as
// `scene.environment` (three converts equirect → PMREM internally) and as
// `scene.background`.
export default function loadHdrEnvironmentAsync(url) {
  if (cachedPromises.has(url)) return cachedPromises.get(url);
  const promise = new Promise((resolve, reject) => {
    new RGBELoader().load(
      url,
      (texture) => {
        texture.mapping = EquirectangularReflectionMapping;
        resolve(texture);
      },
      undefined,
      () => {
        // Allow a retry on the next request (transient offline).
        cachedPromises.delete(url);
        reject(new Error(`loadHdrEnvironmentAsync: failed to load ${url}`));
      }
    );
  });
  cachedPromises.set(url, promise);
  return promise;
}

export function disposeCachedHdrEnvironments() {
  const promises = [...cachedPromises.values()];
  cachedPromises.clear();
  promises.forEach((promise) => {
    promise.then((texture) => texture.dispose()).catch(() => {});
  });
}
