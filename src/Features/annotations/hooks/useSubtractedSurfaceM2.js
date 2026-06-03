import { useMemo, useState, useEffect } from "react";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import computeSubtractedSurfaceM2Async from "Features/threedEditor/js/utilsAnnotationsManager/computeSubtractedSurfaceM2Async";

/**
 * Developed surface (m²) removed by a subtraction on an OPEN-surface
 * (EXTRUSION_PROFILE) source annotation. Runs the same 3D boolean carve
 * headlessly for the given annotation only (cheap — one annotation at a time)
 * and returns the area difference, so callers can subtract it from the host's
 * displayed surface. Returns 0 when not applicable.
 */
export default function useSubtractedSurfaceM2(annotation) {
  const baseMap = useMainBaseMap();
  const [removedM2, setRemovedM2] = useState(0);

  const isProfile = annotation?.shape3D?.key === "EXTRUSION_PROFILE";
  const targets = annotation?.subtractionTargets;

  // Recompute only when something geometry-affecting changes.
  const signature = useMemo(() => {
    if (!isProfile || !targets?.length) return null;
    return JSON.stringify({
      id: annotation.id,
      u: annotation.updatedAt,
      orient: annotation.extrusionOrientation,
      pts: (annotation.points || []).map((p) => [p.x, p.y]),
      targets: targets.map((t) => [
        t.id,
        t.updatedAt,
        t.height,
        (t.points || []).map((p) => [p.x, p.y, p.offsetTop, p.offsetBottom]),
      ]),
    });
  }, [isProfile, targets, annotation]);

  useEffect(() => {
    let cancelled = false;
    if (!signature || !baseMap) {
      setRemovedM2(0);
      return;
    }
    const imageSize = baseMap.getImageSize?.() || baseMap.image?.imageSize;
    const meterByPx = baseMap.getMeterByPx?.() ?? baseMap.meterByPx;
    if (!imageSize?.width || !meterByPx) {
      setRemovedM2(0);
      return;
    }
    const baseMapForRender = {
      imageWidth: imageSize.width,
      imageHeight: imageSize.height,
      meterByPx,
    };
    computeSubtractedSurfaceM2Async(annotation, baseMapForRender, targets).then(
      (v) => {
        if (!cancelled) setRemovedM2(v || 0);
      }
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, baseMap]);

  return removedM2;
}
