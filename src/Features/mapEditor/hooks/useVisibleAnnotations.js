import { useMemo } from "react";
import { useSelector } from "react-redux";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useMeshCellRelations from "Features/annotations/hooks/useMeshCellRelations";

// Annotations currently visible in the map editor: same filters as
// MainMapEditorV3 (hidden listings, scope, main baseMap, baseMaps viewer
// split) + the "Maillage" toggle (cells vs meshed parents).
export default function useVisibleAnnotations() {
  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const openedPanel = useSelector((s) => s.listings.openedPanel);
  const hideBaseMapAnnotations = openedPanel !== "BASE_MAP_DETAIL";

  const rawAnnotations = useAnnotationsV2({
    caller: "useVisibleAnnotations",
    excludeListingsIds: hiddenListingsIds,
    hideBaseMapAnnotations,
    filterByMainBaseMap: true,
    filterBySelectedScope: true,
    excludeIsForBaseMapsListings: viewerKey !== "BASE_MAPS",
    onlyIsForBaseMapsListings: viewerKey === "BASE_MAPS",
  });

  const showMeshCells = useSelector((s) => s.annotations.showMeshCells);
  const { parentIdSet } = useMeshCellRelations();

  return useMemo(() => {
    if (!rawAnnotations) return rawAnnotations;
    if (!showMeshCells) return rawAnnotations.filter((a) => !a.isMeshCell);
    return rawAnnotations.filter((a) => !parentIdSet.has(a.id));
  }, [rawAnnotations, showMeshCells, parentIdSet]);
}
