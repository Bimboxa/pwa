import { createContext, useContext, useSyncExternalStore } from "react";

// Flushed map zoom shared with JS consumers.
//
// MapEditorViewport writes the camera zoom to the `--map-zoom` CSS variable
// (deferred until the end of a wheel gesture). Children that must compute
// screen-constant geometry in JS (e.g. the chip-edge attach point of a label
// leader) need the SAME value at the SAME moment: the viewport publishes it
// here right after the CSS write, so CSS scale and JS geometry agree by
// construction, including during the gesture freeze.
//
// No provider (portfolio, listing viewer…) => zoom 1: containerK carries the
// whole scale there.

export const MapZoomContext = createContext(null);

export function createMapZoomStore(initial = 1) {
  let value = initial;
  const subscribers = new Set();
  return {
    get: () => value,
    set: (k) => {
      if (!Number.isFinite(k) || k === value) return;
      value = k;
      subscribers.forEach((cb) => cb());
    },
    subscribe: (cb) => {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
  };
}

const subscribeNoop = () => () => {};
const getOne = () => 1;

export default function useMapZoom(enabled = true) {
  const store = useContext(MapZoomContext);
  const active = Boolean(store) && enabled;
  return useSyncExternalStore(
    active ? store.subscribe : subscribeNoop,
    active ? store.get : getOne
  );
}
