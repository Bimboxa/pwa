import { useEffect, useMemo } from "react";
import { useSelector } from "react-redux";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMeshCellRelations from "Features/annotations/hooks/useMeshCellRelations";
import useExtraBaseMapIdsIn3d from "./useExtraBaseMapIdsIn3d";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

export default function useAutoLoadAnnotationsInThreedEditor({
  threedEditor,
  rendererIsReady,
}) {
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const isActiveViewer = isThreedFamilyViewerKey(selectedViewerKey);
  const disableOpacity = useSelector((s) => s.threedEditor.disableOpacity);
  const antiAliasingShrink = useSelector(
    (s) => s.threedEditor.antiAliasingShrink
  );
  // Réaliste / Photoréaliste build annotation objects with native PBR
  // materials + shadow flags. A mode toggle rebuilds every 3D object (same
  // lifecycle as disableOpacity) — post-hoc material swapping is forbidden,
  // it would fight the hover/dim originalMaterial cache.
  const renderMode = useSelector((s) => s.threedEditor.renderMode);
  const realisticShading = renderMode !== "STANDARD";
  const showMeshCells = useSelector((s) => s.annotations.showMeshCells);
  const { parentIdSet } = useMeshCellRelations();
  const baseMapOpacityIn3d = useSelector(
    (s) => s.threedEditor.baseMapOpacityIn3d
  );
  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);

  // Other base maps whose annotations are requested (mode !== NONE), excluding
  // the main one (always loaded by `filterByMainBaseMap`).
  const { value: baseMaps = [] } = useBaseMaps();

  const extraBaseMapIds = useExtraBaseMapIdsIn3d();

  const annotations = useAnnotationsV2({
    caller: "MainThreedEditor",
    enabled: isActiveViewer,
    withEntity: true,
    excludeListingsIds: hiddenListingsIds,
    hideBaseMapAnnotations: true,
    filterByMainBaseMap: true,
    extraBaseMapIds,
    filterBySelectedScope: true,
    sortByOrderIndex: true,
    excludeIsForBaseMapsListings: true,
    excludeProfileTemplates: true,
    // Solo mode dims (instead of hides) non-soloed annotations in 3D —
    // ThreedSelectionDimmer renders them translucent.
    keepSoloDimmed: true,
  });

  // "Afficher les mailles": ON → replace parents that have mesh cells by their
  // cells (hide the parent, keep the cells); OFF → hide mesh cells, show parents.
  const annotationsForThreed = useMemo(() => {
    if (!annotations) return annotations;
    if (showMeshCells) {
      return annotations.filter((a) => !parentIdSet.has(a.id));
    }
    return annotations.filter((a) => !a.isMeshCell);
  }, [annotations, showMeshCells, parentIdSet]);

  useEffect(() => {
    if (!threedEditor?.loadAnnotations || !rendererIsReady) return;
    // Ensure the extra base maps' groups exist before (re)creating annotation
    // objects — `createAnnotationsObjects` silently skips annotations whose
    // base map is not in `baseMapsMap`. Idempotent (no-op if already loaded).
    if (threedEditor.ensureBaseMapLoaded) {
      extraBaseMapIds.forEach((id) => {
        const bm = baseMaps.find((b) => b.id === id);
        if (bm?.image?.imageUrlClient) {
          threedEditor.ensureBaseMapLoaded(bm, { opacity: baseMapOpacityIn3d });
        }
      });
    }
    threedEditor.loadAnnotations(annotationsForThreed || [], {
      disableOpacity,
      antiAliasingShrink,
      realisticShading,
    });
  }, [
    rendererIsReady,
    annotationsForThreed,
    threedEditor,
    disableOpacity,
    antiAliasingShrink,
    realisticShading,
    extraBaseMapIds,
    baseMaps,
    baseMapOpacityIn3d,
  ]);

  return annotationsForThreed;
}
