import { useMemo, useState, useEffect } from "react";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import computeSubtractedSurfaceM2Async from "Features/threedEditor/js/utilsAnnotationsManager/computeSubtractedSurfaceM2Async";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";

import isPolylineSheetHost from "../utils/isPolylineSheetHost";

/**
 * Developed surface (m²) removed by a subtraction on an OPEN-surface source
 * annotation (a POLYLINE sheet — PX wall / inline extrusion, see
 * isPolylineSheetHost). Runs the same 3D boolean carve
 * headlessly for the given annotation only (cheap — one annotation at a time)
 * and returns the area difference, so callers can subtract it from the host's
 * displayed surface. Returns 0 when not applicable.
 *
 * Reads the ANNOTATION's own base map, not the selected one: the properties
 * panel can be open on an annotation belonging to another map, and using the
 * selected map's metrics silently produced a wrong area.
 */
export default function useSubtractedSurfaceM2(annotation) {
  const { value: baseMaps, baseMapsUpdatedAt } = useBaseMaps({
    includeDetails: true,
    includeDisabledListings: true,
  });
  const [removedM2, setRemovedM2] = useState(0);

  const baseMapById = useMemo(
    () => getItemsByKey(baseMaps ?? [], "id"),
    [baseMaps]
  );
  const baseMap = baseMapById[annotation?.baseMapId];

  const isOpenSurface = isPolylineSheetHost(annotation);
  const targets = annotation?.subtractionTargets;

  // Recompute only when something geometry-affecting changes.
  const signature = useMemo(() => {
    if (!isOpenSurface || !targets?.length) return null;
    return JSON.stringify({
      id: annotation.id,
      u: annotation.updatedAt,
      // A sheet's lateral surface follows its height and vertical offsets.
      h: [annotation.height, annotation.offsetZ, annotation.strokeWidthUnit],
      pts: (annotation.points || []).map((p) => [
        p.x,
        p.y,
        p.type,
        p.offsetTop,
        p.offsetBottom,
      ]),
      targets: targets.map((t) => [
        t.id,
        t.updatedAt,
        t.height,
        t.offsetZ,
        t.baseMapId,
        (t.points || []).map((p) => [p.x, p.y, p.offsetTop, p.offsetBottom]),
      ]),
      // A base map moved in 3D changes the cross-base-map result.
      bm: baseMapsUpdatedAt,
    });
  }, [isOpenSurface, targets, annotation, baseMapsUpdatedAt]);

  useEffect(() => {
    let cancelled = false;
    if (!signature || !baseMap) {
      setRemovedM2(0);
      return;
    }
    const baseMapForRender = getBaseMapForRender(baseMap);
    if (!baseMapForRender?.imageWidth || !baseMapForRender?.meterByPx) {
      setRemovedM2(0);
      return;
    }
    const isCrossBaseMap = targets.some(
      (t) => t?.baseMapId && t.baseMapId !== annotation?.baseMapId
    );
    computeSubtractedSurfaceM2Async(
      annotation,
      baseMapForRender,
      targets,
      isCrossBaseMap
        ? { sourceBaseMapId: annotation?.baseMapId, baseMapsById: baseMapById }
        : undefined
    ).then((v) => {
      if (!cancelled) setRemovedM2(v?.removedM2 || 0);
    });
    return () => {
      cancelled = true;
    };
    // `signature` is the geometry digest (it folds in the annotation, the
    // targets and baseMapsUpdatedAt), so it is the real trigger here.
  }, [signature, baseMap]);

  return removedM2;
}
