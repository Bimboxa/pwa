import { useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

import { bumpSnapIndexEpoch } from "Features/threedEditor/threedEditorSlice";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useMeshCellRelations from "Features/annotations/hooks/useMeshCellRelations";
import useExtraBaseMapIdsIn3d from "./useExtraBaseMapIdsIn3d";
import getBaseMapOpacityIn3d from "Features/threedEditor/utils/getBaseMapOpacityIn3d";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

export default function useAutoLoadAnnotationsInThreedEditor({
  threedEditor,
  rendererIsReady,
}) {
  const dispatch = useDispatch();
  const selectedViewerKey = useSelector(selectEffectiveViewerKey);
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
  const realisticShading =
    renderMode === "REALISTIC" || renderMode === "PHOTOREAL";
  // PHOTOREAL additionally activates the material3d textured presets +
  // receiveShadow — a REALISTIC↔PHOTOREAL toggle must rebuild objects too.
  const photorealShading = renderMode === "PHOTOREAL";
  // AQUARELLE builds toon "lavis" materials + ink edge lines at rebuild time.
  const aquarelleShading = renderMode === "AQUARELLE";
  const showMeshCells = useSelector((s) => s.annotations.showMeshCells);
  const { parentIdSet } = useMeshCellRelations();
  const baseMapOpacityIn3d = useSelector(
    (s) => s.threedEditor.baseMapOpacityIn3d
  );
  const opacityByBaseMapIdIn3d = useSelector(
    (s) => s.threedEditor.opacityByBaseMapIdIn3d
  );
  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);

  // Other base maps whose annotations are requested (mode !== NONE), excluding
  // the main one (always loaded by `filterByMainBaseMap`).
  const { value: baseMaps = [] } = useBaseMaps();
  const mainBaseMap = useMainBaseMap();

  // Photo baseMaps follow the standard chips mechanism: their annotations
  // join the 3D emission when the chip's annotation mode is set (an entry in
  // annotationsModeByBaseMapIdIn3d) — calibrated ones are then reconstructed
  // on their photoPlan's world pose, the rest silently bail in
  // AnnotationsManager (no baseMap group in the scene).
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

  // Leaving the 3D viewer must NOT unload the scene (meshes stay alive while
  // the panel is CSS-hidden, so re-entering is instant) — but the disabled
  // useAnnotationsV2 run freezes one `[]` reference that dexie-react-hooks
  // re-emits on re-enable BEFORE the fresh liveQuery resolves. Capture that
  // raw hook output at the false→true flip so the effect can skip it: the
  // fresh run always produces a NEW reference, even when legitimately empty,
  // so "delete everything in 2D then toggle" still clears the scene. Guard on
  // `annotations` (raw output), not `annotationsForThreed` — the filter memo
  // re-allocates on showMeshCells/parentIdSet changes and would defeat the
  // reference comparison.
  const prevActiveRef = useRef(isActiveViewer);
  const staleResultRef = useRef(null);
  if (isActiveViewer && !prevActiveRef.current) {
    staleResultRef.current = annotations;
  }
  prevActiveRef.current = isActiveViewer;

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
    // While hidden, keep the scene as-is: no unload on 3D→2D, no reload on
    // background emissions (the pipeline is disabled anyway). Project /
    // main-map switches dispose the annotation objects via loadMaps.
    if (!isActiveViewer) return;
    if (!threedEditor?.loadAnnotations || !rendererIsReady) return;
    // Stale `[]` re-emitted by the enabled flip — the fresh emission follows.
    if (annotations === staleResultRef.current) return;
    staleResultRef.current = null;
    // Ensure the base maps' groups exist AND their registry entries are fresh
    // before (re)creating annotation objects — `createAnnotationsObjects`
    // silently skips annotations whose base map is not in `baseMapsMap`, and
    // positions them with the registered meterByPx (stale if the entry was
    // stored before the scale was set). Includes the MAIN base map for that
    // reason. Idempotent (no-op if already loaded).
    if (threedEditor.ensureBaseMapLoaded) {
      const opacityState = {
        baseMapOpacityIn3d,
        opacityByBaseMapIdIn3d,
      };
      if (mainBaseMap?.id) {
        threedEditor.ensureBaseMapLoaded(mainBaseMap, {
          opacity: getBaseMapOpacityIn3d(opacityState, mainBaseMap.id),
        });
      }
      extraBaseMapIds.forEach((id) => {
        const bm = baseMaps.find((b) => b.id === id);
        if (bm?.image?.imageUrlClient) {
          threedEditor.ensureBaseMapLoaded(bm, {
            opacity: getBaseMapOpacityIn3d(opacityState, id),
          });
        }
      });
    }
    threedEditor.loadAnnotations(annotationsForThreed || [], {
      disableOpacity,
      antiAliasingShrink,
      realisticShading,
      photorealShading,
      aquarelleShading,
    });
    // The scene's annotation objects just changed: resync the drawing snap /
    // face-detection index. Deterministic counterpart of the 350 ms
    // post-commit bump in useDrawingPointerHandlers, which loses the race
    // when the liveQuery → resolve → load pipeline takes longer (a freshly
    // committed face's edges then silently never became snappable). The
    // rebuild itself only runs while the 3D drawing mode is active.
    dispatch(bumpSnapIndexEpoch());
  }, [
    rendererIsReady,
    isActiveViewer,
    annotations,
    annotationsForThreed,
    threedEditor,
    disableOpacity,
    antiAliasingShrink,
    realisticShading,
    photorealShading,
    aquarelleShading,
    extraBaseMapIds,
    baseMaps,
    mainBaseMap,
    baseMapOpacityIn3d,
    opacityByBaseMapIdIn3d,
  ]);

  return annotationsForThreed;
}
