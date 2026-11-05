import {
  createContext,
  useContext,
  useRef,
  useSyncExternalStore,
} from "react";

// LIVE camera of the map viewport, for the few children that must follow a
// pan / zoom gesture as it happens (the editor grid changing its cell size
// while zooming).
//
// Unlike useMapZoom — the zoom flushed at the END of a gesture, in step with
// the --map-zoom CSS variable — this store is notified on every applied
// camera transform (one per animation frame). It is therefore only exposed
// through a SELECTOR: the component re-renders when the selected value
// changes, not on every frame.
//
// No provider (portfolio, listing viewer…) => the hook returns null.

export const MapCameraContext = createContext(null);

// getCamera: () => { x, y, k, getViewportSize: () => ({ width, height }) }
// (viewport size behind a getter: reading it forces a layout, so only the
// selectors that need it pay for it).
export function createMapCameraStore(getCamera) {
  const subscribers = new Set();
  return {
    get: getCamera,
    notify: () => subscribers.forEach((cb) => cb()),
    subscribe: (cb) => {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
  };
}

const subscribeNoop = () => () => {};

// selector(camera, previous) => value. Return `previous` (same reference)
// when nothing relevant changed: no re-render then. Primitives compare by
// value.
export default function useMapCameraSelector(selector, enabled = true) {
  const store = useContext(MapCameraContext);
  const active = Boolean(store) && enabled;
  const lastRef = useRef(null);

  const getSnapshot = () => {
    lastRef.current = active ? selector(store.get(), lastRef.current) : null;
    return lastRef.current;
  };

  return useSyncExternalStore(
    active ? store.subscribe : subscribeNoop,
    getSnapshot
  );
}
