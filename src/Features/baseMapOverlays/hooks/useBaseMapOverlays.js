import { useMemo } from "react";
import { useSelector } from "react-redux";

import useBaseMapsGridAnnotations from "Features/baseMapsGrid/hooks/useBaseMapsGridAnnotations";
import useDisabledBaseMapIds from "Features/baseMaps/hooks/useDisabledBaseMapIds";

import areBaseMapsParallel from "Features/baseMaps/js/areBaseMapsParallel";
import getBaseMapToBaseMapPxMatrix, {
  baseMapMatrixToSvg,
} from "Features/baseMaps/js/getBaseMapToBaseMapPxMatrix";

const EMPTY = [];

// Base maps overlaid (greyed) on the main one in the 2D editor: the ones
// switched on in the base maps list (eye = image, badge = annotations) that
// are PARALLEL to the main base map and calibrated, each with the affine
// transform taking its pixels to the main base map's pixels (both 3D
// placements, projection along the normal). Base maps of the folders disabled
// for the scope are skipped whatever their persisted toggles say (the list
// hides them, no row would switch them off — see useDisabledBaseMapIds).
//
// Returns a memoized array of
//   { baseMap, matrix, matrixStr, showImage, annotations }
// — stable while neither the base maps nor the toggles nor the overlaid
// annotations change (never during pan / zoom / drag).
export default function useBaseMapOverlays({
  baseMap,
  baseMaps,
  enabled,
  forViewerKey,
}) {
  // data

  const visibleIds = useSelector((s) => s.viewers.visibleBaseMapIdsIn2d);
  const annotationsIds = useSelector(
    (s) => s.viewers.annotationsBaseMapIdsIn2d
  );
  const { disabledIds } = useDisabledBaseMapIds();

  // helpers

  const placed = useMemo(() => {
    if (!enabled || !baseMap || baseMap.isPhoto) return EMPTY;
    if (visibleIds.length === 0 && annotationsIds.length === 0) return EMPTY;
    const result = [];
    for (const bm of baseMaps ?? []) {
      if (bm.id === baseMap.id || bm.isPhoto) continue;
      if (disabledIds.has(bm.id)) continue;
      const showImage = visibleIds.includes(bm.id);
      const showAnnotations = annotationsIds.includes(bm.id);
      if (!showImage && !showAnnotations) continue;
      if (!areBaseMapsParallel(bm, baseMap)) continue;
      const matrix = getBaseMapToBaseMapPxMatrix(bm, baseMap);
      if (!matrix) continue;
      result.push({
        baseMap: bm,
        matrix,
        matrixStr: baseMapMatrixToSvg(matrix),
        showImage,
        showAnnotations,
      });
    }
    return result.length > 0 ? result : EMPTY;
  }, [enabled, baseMap, baseMaps, visibleIds, annotationsIds, disabledIds]);

  const annotationsBaseMapIds = useMemo(
    () => placed.filter((o) => o.showAnnotations).map((o) => o.baseMap.id),
    [placed]
  );

  // main

  const annotationsByBaseMapId = useBaseMapsGridAnnotations({
    baseMapIds: annotationsBaseMapIds,
    forViewerKey,
    ignoreHideAnnotations: true,
  });

  return useMemo(() => {
    if (placed === EMPTY) return EMPTY;
    return placed.map((overlay) => ({
      ...overlay,
      annotations:
        (overlay.showAnnotations &&
          annotationsByBaseMapId[overlay.baseMap.id]) ||
        EMPTY,
    }));
  }, [placed, annotationsByBaseMapId]);
}
