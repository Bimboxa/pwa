import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Screen-fixed Z axis for the elevation editor. The axis is pinned to a fixed
// SCREEN edge (left / right) while the profile pans & zooms; from the live
// camera it derives the axis's WORLD x, so the Z = 0 line can reach it and the
// Offset field can sit a fixed screen distance from it (both re-computed on
// pan/zoom). Small editor → re-rendering on pan is cheap.
//
//   - side = LEFT of the central (median) axis → axis on the RIGHT (out of the
//     profile's way), and vice-versa. No median (POLYGON surface, no guide) →
//     fixed "right".
//   - zAxisWorldX = inverse camera map of the fixed screen edge.
//
// Inputs:
//   - viewportRef: MapEditorViewport ref (getViewportSize for the width).
//   - bbox: { minX, maxX } of the developed profile (section-space) — its
//     center is compared to `medianS`.
//   - medianS: the annotation central axis abscissa (guideTrait.medianS) or
//     null/undefined when there is none.
//
// Returns { zoom, zAxisSide, zAxisWorldX, onCameraChange, rootRef }: wire
// `onCameraChange` on the viewport and `rootRef` on the editor root element.
const Z_AXIS_INSET_PX = 24;

export default function useElevationZAxis({ viewportRef, bbox, medianS }) {
  // live map zoom (read from the camera) → keeps screen-fixed gaps/margins
  // constant at any zoom level
  const [zoom, setZoom] = useState(1);
  // live camera pan-x + viewport width → let us pin the axis to a screen edge
  const [camX, setCamX] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const rootRef = useRef(null);

  const onCameraChange = useCallback(
    (m) => {
      setZoom((z) => (z === m.k ? z : m.k));
      setCamX((x) => (x === m.x ? x : m.x));
      const vw = viewportRef.current?.getViewportSize?.().width ?? 0;
      if (vw) setViewportWidth((w) => (w === vw ? w : vw));
    },
    [viewportRef]
  );

  // Second writer of viewportWidth: keeps it fresh on resize (no camera event).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => setViewportWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // profile side vs the central (median) axis; fixed "right" without a median.
  const zAxisSide = useMemo(() => {
    if (!bbox || !Number.isFinite(medianS)) return "right";
    const center = (bbox.minX + bbox.maxX) / 2;
    return center <= medianS ? "right" : "left";
  }, [bbox, medianS]);

  // world x mapped from the fixed screen edge: viewportX = worldX * k + camX.
  const zAxisWorldX = useMemo(() => {
    if (!viewportWidth || !zoom) return null;
    const screenX =
      zAxisSide === "right" ? viewportWidth - Z_AXIS_INSET_PX : Z_AXIS_INSET_PX;
    return (screenX - camX) / zoom;
  }, [viewportWidth, zoom, camX, zAxisSide]);

  return { zoom, zAxisSide, zAxisWorldX, onCameraChange, rootRef };
}

export { Z_AXIS_INSET_PX };
