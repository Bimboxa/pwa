import { useMemo } from "react";
import { useSelector } from "react-redux";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useMeshCellRelations from "Features/annotations/hooks/useMeshCellRelations";

const EMPTY = {};

// Annotations of the sheets displayed on the table, grouped by base map.
// Same context as the map editor the grid was opened from (mirrors the
// useAnnotationsV2 call of MainMapEditorV3: hidden listings, scope, baseMaps
// viewer split, "Maillage" toggle, annotations eye) — only the main-base-map
// filter is swapped for the ids of the sheets, loaded in ONE query.
export default function useBaseMapsGridAnnotations({
  baseMapIds,
  forViewerKey,
}) {
  // data

  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);
  const openedPanel = useSelector((s) => s.listings.openedPanel);
  const showAnnotationsInBaseMaps = useSelector(
    (s) => s.baseMapEditor.showAnnotations
  );
  const hideAnnotations = useSelector(
    (s) => forViewerKey !== "BASE_MAPS" && s.viewers.hideAnnotationsInViewer
  );
  const showMeshCells = useSelector((s) => s.annotations.showMeshCells);
  const { parentIdSet } = useMeshCellRelations();

  // helpers

  const isBaseMapsViewer = forViewerKey === "BASE_MAPS";
  const [firstId, ...otherIds] = baseMapIds ?? [];

  // main

  const annotations = useAnnotationsV2({
    caller: "useBaseMapsGridAnnotations",
    enabled: Boolean(firstId) && !hideAnnotations,
    excludeListingsIds: hiddenListingsIds,
    hideBaseMapAnnotations: openedPanel !== "BASE_MAP_DETAIL",
    filterByBaseMapId: firstId,
    extraBaseMapIds: otherIds,
    filterBySelectedScope: true,
    sortByOrderIndex: true,
    excludeIsForBaseMapsListings: !isBaseMapsViewer,
    onlyIsForBaseMapsListings: isBaseMapsViewer && !showAnnotationsInBaseMaps,
  });

  return useMemo(() => {
    if (!annotations?.length || hideAnnotations) return EMPTY;
    const ids = new Set(baseMapIds);
    const byBaseMapId = {};
    annotations.forEach((annotation) => {
      // temp annotations are appended whatever their base map
      if (!ids.has(annotation.baseMapId)) return;
      if (showMeshCells) {
        if (parentIdSet.has(annotation.id)) return;
      } else if (annotation.isMeshCell) return;
      if (!byBaseMapId[annotation.baseMapId]) {
        byBaseMapId[annotation.baseMapId] = [];
      }
      byBaseMapId[annotation.baseMapId].push(annotation);
    });
    return byBaseMapId;
    // baseMapIds: its content is tracked by the annotations query itself.
  }, [annotations, hideAnnotations, showMeshCells, parentIdSet]);
}
