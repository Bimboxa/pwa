import { useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import {
  bumpSnapIndexEpoch,
  bumpAnnotationsLoadTick,
  setRevolutionAxisSectionPlanes,
} from "Features/threedEditor/threedEditorSlice";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useMeshCellRelations from "Features/annotations/hooks/useMeshCellRelations";
import useExtraBaseMapIdsIn3d from "./useExtraBaseMapIdsIn3d";
import useDessinGridBaseMapIds from "Features/baseMapsGrid3d/hooks/useDessinGridBaseMapIds";
import useScopeGridAnnotationsFilter from "Features/listingViewer/hooks/useScopeGridAnnotationsFilter";
import { selectBaseMapsGridScopeOpen } from "Features/baseMapsGrid/utils/selectBaseMapsGridPinned";
import { selectBaseMapsGridDessinOpen } from "Features/baseMapsGrid/utils/selectBaseMapsGridDessin";
import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import baseMapLocalToWorld from "Features/baseMaps/js/baseMapLocalToWorld";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

// Annotations built WITHOUT the anti-aliasing shrink (« Pinceau »): copies
// tagged `_noAntiAliasingShrink`, memoized per source row so the copy keeps
// its identity across emissions — diffAnnotationsForBuild then rebuilds
// exactly the hosts whose exemption changed.
const shrinkExemptCopies = new WeakMap();
function getShrinkExemptCopy(annotation) {
  let copy = shrinkExemptCopies.get(annotation);
  if (!copy) {
    copy = { ...annotation, _noAntiAliasingShrink: true };
    shrinkExemptCopies.set(annotation, copy);
  }
  return copy;
}

export default function useAutoLoadAnnotationsInThreedEditor({
  threedEditor,
  rendererIsReady,
}) {
  const dispatch = useDispatch();
  const selectedViewerKey = useSelector(selectEffectiveViewerKey);
  const isActiveViewer = isThreedFamilyViewerKey(selectedViewerKey);
  // BaseMap module in 3D: same gate as the 2D MainMapEditorV3 instances.
  const isBaseMapsModule = useSelector(
    (s) => s.viewers.selectedViewerKey === "BASE_MAPS"
  );
  // "Afficher les annotations" switch of the Fond de plan panel: ON loads
  // the scope annotations (OFF = bare base maps).
  const showAnnotationsInBaseMaps = useSelector(
    (s) => s.baseMapEditor.showAnnotations
  );
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
  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);
  // REVOLUTION half-view: revolutions built from a profile on a VERTICAL base
  // map render only the 180° half on the side opposite the camera (the image
  // reads as a section plane). Display only — quantities stay full-rotation
  // because this travels as a build option, never written on the annotation,
  // and the headless carve path (computeSubtractedSurfaceM2Async) builds
  // without loader options.
  const revolutionSectionSideByBaseMapId = useSelector(
    (s) => s.threedEditor.revolutionSectionSideByBaseMapId
  );
  // "Pochage des coupes" switch: fill closed-profile sections of partial
  // revolutions with a flat dark face (ink boundary lines are always on).
  const revolutionSectionFill = useSelector(
    (s) => s.threedEditor.revolutionSectionFillIn3d
  );

  // Other base maps whose annotations are requested (mode !== NONE), excluding
  // the main one (always loaded by `filterByMainBaseMap`).
  const { value: baseMaps = [] } = useBaseMaps();
  const mainBaseMap = useMainBaseMap();

  // Photo baseMaps follow the standard chips mechanism: their annotations
  // join the 3D emission when the chip's annotation mode is set (an entry in
  // annotationsModeByBaseMapIdIn3d) — calibrated ones are then reconstructed
  // on their photoPlan's world pose, the rest silently bail in
  // AnnotationsManager (no baseMap group in the scene).
  const chipExtraBaseMapIds = useExtraBaseMapIdsIn3d();

  // Pinned base maps grid (SCOPE module): every sheet of the table
  // (baseMapsGrid.scopeSheets, driven by the scope content selection) shows
  // its annotations, whatever its chip mode; narrowed to the listing selected
  // in the scope panel (useScopeGridAnnotationsFilter).
  const gridPinned = useSelector(selectBaseMapsGridScopeOpen);
  const scopeFilter = useScopeGridAnnotationsFilter();
  const scopeSheetIds = useSelector(
    (s) => s.baseMapsGrid.scopeSheets.baseMapIds
  );
  // Dessin module's base maps grid (direct display): every base map of the
  // scope is a sheet and shows EVERY annotation drawn on it — the Dessin
  // listing eyes, the template eyes and the solos do not apply; the badge
  // of a sheet greys its annotations (ThreedSelectionDimmer) instead of
  // leaving them out. The sheets that do not take part in the scene only
  // get their group (the table textures them with a preview), never the
  // full image.
  const gridDessin = useSelector(selectBaseMapsGridDessinOpen);
  const dessinSheetIds = useDessinGridBaseMapIds();
  const sheetIdsKey = useMemo(() => {
    const sheetIds = gridPinned
      ? scopeSheetIds
      : gridDessin
        ? dessinSheetIds
        : null;
    if (!sheetIds) return "";
    return sheetIds
      .filter((id) => id !== mainBaseMap?.id)
      .sort()
      .join(",");
  }, [gridPinned, gridDessin, scopeSheetIds, dessinSheetIds, mainBaseMap?.id]);
  const extraBaseMapIds = useMemo(() => {
    if (!sheetIdsKey) return chipExtraBaseMapIds;
    return [
      ...new Set([...chipExtraBaseMapIds, ...sheetIdsKey.split(",")]),
    ].filter(Boolean);
  }, [chipExtraBaseMapIds, sheetIdsKey]);
  const scopeAnnotationIdSet = gridPinned ? scopeFilter.annotationIdSet : null;
  // badge of the "Fonds de plan" rows: annotations of a sheet switched off
  const hiddenSheetIds = useSelector(
    (s) => s.baseMapsGrid.hiddenAnnotationsBaseMapIds
  );
  const hiddenSheetIdSet = useMemo(
    () =>
      gridPinned && hiddenSheetIds.length ? new Set(hiddenSheetIds) : null,
    [gridPinned, hiddenSheetIds]
  );

  const annotations = useAnnotationsV2({
    caller: "MainThreedEditor",
    enabled:
      isActiveViewer && !(isBaseMapsModule && !showAnnotationsInBaseMaps),
    excludeListingsIds: gridDessin ? undefined : hiddenListingsIds,
    keepHiddenTemplates: gridDessin,
    ignoreSolo: gridDessin,
    hideBaseMapAnnotations: true,
    filterByMainBaseMap: true,
    extraBaseMapIds,
    filterByListingId: gridPinned ? scopeFilter.filterByListingId : undefined,
    filterBySelectedScope: true,
    sortByOrderIndex: true,
    excludeProfileTemplates: true,
    // COTE / RULER only when template.showIn3d or row.isDrawnIn3d.
    excludeDimensionsHiddenIn3d: true,
    // Solo mode dims (instead of hides) non-soloed annotations in 3D —
    // ThreedSelectionDimmer renders them translucent.
    keepSoloDimmed: !gridDessin,
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

  // Anti-aliasing shrink exemption: hosts of live painted parts (persistent
  // in effect: derived from db.meshPaints) ∪ the session exemptions (a host
  // about to be painted or converted to a mesh — ensureUnshrunkHostObject).
  // The liveQuery returns a string key: an unchanged set never re-renders.
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const paintedHostIdsKey = useLiveQuery(
    async () => {
      if (!projectId || !db.meshPaints) return "";
      const rows = await db.meshPaints
        .where("projectId")
        .equals(projectId)
        .toArray();
      return [
        ...new Set(
          rows.filter((r) => !r.deletedAt).map((r) => r.hostAnnotationId)
        ),
      ]
        .filter(Boolean)
        .sort()
        .join(",");
    },
    [projectId],
    ""
  );
  const sessionShrinkExemptIds = useSelector(
    (s) => s.meshPaint.shrinkExemptAnnotationIds
  );
  const shrinkExemptIds = useMemo(() => {
    const ids = new Set(sessionShrinkExemptIds || []);
    (paintedHostIdsKey || "")
      .split(",")
      .filter(Boolean)
      .forEach((id) => ids.add(id));
    return ids;
  }, [paintedHostIdsKey, sessionShrinkExemptIds]);

  // "Afficher les mailles": ON → replace parents that have mesh cells by their
  // cells (hide the parent, keep the cells); OFF → hide mesh cells, show parents.
  // Pinned grid narrowed to a business-objects listing: only the annotations
  // linked to its objects (the listing owns none — a post-filter, after the
  // stale-result guard above; element references are kept, so the 3D diff
  // rebuilds nothing for the kept ones).
  const annotationsForThreed = useMemo(() => {
    if (!annotations) return annotations;
    let result = annotations;
    if (scopeAnnotationIdSet) {
      result = result.filter((a) => scopeAnnotationIdSet.has(a.id));
    }
    if (hiddenSheetIdSet) {
      result = result.filter((a) => !hiddenSheetIdSet.has(a.baseMapId));
    }
    if (showMeshCells) {
      return result.filter((a) => !parentIdSet.has(a.id));
    }
    return result.filter((a) => !a.isMeshCell);
  }, [
    annotations,
    showMeshCells,
    parentIdSet,
    scopeAnnotationIdSet,
    hiddenSheetIdSet,
  ]);

  // What the scene is built from: the shrink-exempt hosts swapped for their
  // tagged copies (the hook still returns the plain resolved annotations).
  const annotationsForBuild = useMemo(() => {
    if (!annotationsForThreed || shrinkExemptIds.size === 0) {
      return annotationsForThreed;
    }
    return annotationsForThreed.map((a) =>
      shrinkExemptIds.has(a.id) ? getShrinkExemptCopy(a) : a
    );
  }, [annotationsForThreed, shrinkExemptIds]);

  // { baseMapId: 1 | -1 }, restricted to the vertical base maps that host a
  // REVOLUTION element in half-view (its AXIS's "Demi-vue 3D" toggle,
  // resolved per arc into `revolutionHalfView`) without an explicit partial
  // sector — a POLYLINE arc (lathe surface) or a POINT (circle line). The
  // sector lives on the plan AXIS too and is resolved
  // per-arc by useAnnotationsV2 into `revolutionPhi`; when it is set, those
  // explicit angles win over the auto half-view (same precedence as
  // getRevolutionPartialPhi in createAnnotationObject3D). Restricting the map
  // keeps the build epoch stable — a camera side flip on an unrelated base map
  // must not rebuild the scene.
  const revolutionSection = useMemo(() => {
    const revBaseMapIds = new Set(
      (annotationsForThreed || [])
        .filter(
          (a) =>
            (a.type === "POLYLINE" || a.type === "POINT") &&
            a.shape3D?.key === "REVOLUTION" &&
            a.revolutionHalfView &&
            !a.revolutionPhi
        )
        .map((a) => a.baseMapId)
    );
    if (revBaseMapIds.size === 0) return null;
    const out = {};
    baseMaps.forEach((bm) => {
      if (!revBaseMapIds.has(bm.id)) return;
      if (getBaseMapTransform(bm).orientation !== "VERTICAL") return;
      out[bm.id] = revolutionSectionSideByBaseMapId?.[bm.id] ?? 1;
    });
    return Object.keys(out).length > 0 ? out : null;
  }, [annotationsForThreed, baseMaps, revolutionSectionSideByBaseMapId]);
  // Plan REVOLUTION_AXES whose "Demi-vue 3D" is on (and no explicit sector):
  // their base circle in 3D shows the kept half as a thick arc and the
  // cut-away half as a thin dashed one (like the 2D glyph).
  const halfViewAxes = useMemo(
    () =>
      (annotationsForThreed || []).filter(
        (a) =>
          a.type === "REVOLUTION_AXIS" &&
          a.halfViewIn3d !== false &&
          !a.partialRevolution &&
          a.point
      ),
    [annotationsForThreed]
  );

  // Cut plane of each of those axes, in WORLD coordinates, for the camera
  // side tracker (useRevolutionSectionIn3d). The plane is the one a vertical
  // base map posed from the axis would occupy: through the axis centre,
  // along the diameter direction; its +normal side is the −90° side of the
  // diameter in the plan local frame (the +90° CCW side is the "orange"
  // half behind the plane — getRevolutionAxisPlanFrame). Probed through
  // baseMapLocalToWorld so the plan's own angleDeg / y-flip stay in one
  // place (same technique as computeVerticalBaseMapPlacementFromAxis).
  const baseMapById = useMemo(
    () => Object.fromEntries((baseMaps || []).map((bm) => [bm.id, bm])),
    [baseMaps]
  );
  const axisPlanesKey = halfViewAxes
    .map((a) => {
      const bm = baseMapById[a.baseMapId];
      const t = bm ? getBaseMapTransform(bm) : null;
      return [
        a.id,
        a.point?.x,
        a.point?.y,
        a.directionDeg,
        a.invertHalf ? 1 : 0,
        a.baseMapId,
        t
          ? `${t.angleDeg}:${t.position.x},${t.position.y},${t.position.z}`
          : "",
      ].join(":");
    })
    .join("|");
  useEffect(() => {
    const planes = {};
    halfViewAxes.forEach((a) => {
      const bm = baseMapById[a.baseMapId];
      if (!bm) return;
      const size = bm.getImageSize?.() || bm.image?.imageSize;
      const m = bm.getMeterByPx?.() ?? bm.meterByPx;
      if (!size?.width || !size?.height || !(m > 0)) return;
      const t = getBaseMapTransform(bm);
      if (t.orientation === "VERTICAL") return;
      const local = {
        x: (a.point.x - size.width / 2) * m,
        y: -(a.point.y - size.height / 2) * m,
      };
      const theta =
        ((Number(a.directionDeg) || 0) * Math.PI) / 180 +
        (a.invertHalf ? Math.PI : 0);
      const c = baseMapLocalToWorld(local, t);
      const n = baseMapLocalToWorld(
        { x: local.x + Math.sin(theta), y: local.y - Math.cos(theta) },
        t
      ).sub(c);
      if (!c || !(n.length() > 1e-9)) return;
      n.normalize();
      planes[a.id] = { center: [c.x, c.y, c.z], normal: [n.x, n.y, n.z] };
    });
    dispatch(setRevolutionAxisSectionPlanes(planes));
  }, [axisPlanesKey]);

  const revolutionSectionSideByAxisId = useSelector(
    (s) => s.threedEditor.revolutionSectionSideByAxisId
  );

  // { axisId: 1 | -1 }: camera side per half-viewed axis. An arc of the axis
  // half-viewed on a vertical base map gives the side the lathes actually
  // use (the planes coincide: the base map was posed from the axis's
  // diameter); otherwise the axis's own cut plane tracker does.
  const revolutionSectionByAxisId = useMemo(() => {
    if (halfViewAxes.length === 0) return null;
    const fromArcs = {};
    if (revolutionSection) {
      (annotationsForThreed || []).forEach((a) => {
        if (a.shape3D?.key !== "REVOLUTION" || !a.revolutionHalfView) return;
        if (a.revolutionPhi) return;
        const axisId = a.shape3D?.axisAnnotationId;
        const side = revolutionSection[a.baseMapId];
        if (!axisId || !side || fromArcs[axisId]) return;
        fromArcs[axisId] = side;
      });
    }
    const out = {};
    halfViewAxes.forEach((a) => {
      out[a.id] = fromArcs[a.id] ?? revolutionSectionSideByAxisId?.[a.id] ?? 1;
    });
    return out;
  }, [
    halfViewAxes,
    annotationsForThreed,
    revolutionSection,
    revolutionSectionSideByAxisId,
  ]);
  // Serialized form for the build epoch (see getBuildEpochKey). The per-axis
  // part is there so re-pointing an arc at another axis (same base map, same
  // side) still rebuilds the axes' circles.
  const revolutionSectionKey = [
    revolutionSection
      ? Object.entries(revolutionSection)
          .map(([id, side]) => `${id}:${side}`)
          .join("|")
      : "",
    revolutionSectionByAxisId
      ? Object.entries(revolutionSectionByAxisId)
          .map(([id, side]) => `${id}:${side}`)
          .join("|")
      : "",
  ].join("#");

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
      if (mainBaseMap?.id) {
        threedEditor.ensureBaseMapLoaded(mainBaseMap);
      }
      const chipExtraIdSet = new Set(chipExtraBaseMapIds);
      const imagesManager = threedEditor.sceneManager?.imagesManager;
      extraBaseMapIds.forEach((id) => {
        const bm = baseMaps.find((b) => b.id === id);
        if (!bm) return;
        // Dessin grid: a sheet that does not take part in the scene gets
        // its group / registry entry only (the annotations are built in
        // it) — the table shows a preview, the full image is never loaded.
        if (gridDessin && !chipExtraIdSet.has(id) && imagesManager) {
          imagesManager.ensureBaseMapGroup(bm);
          imagesManager.baseMapsMap[bm.id] = bm;
          return;
        }
        // Pinned grid: every sheet gets its group / registry entry (the
        // annotations are built in it), image or not.
        if (bm.image?.imageUrlClient || (gridPinned && bm)) {
          threedEditor.ensureBaseMapLoaded(bm);
        }
      });
    }
    threedEditor.loadAnnotations(annotationsForBuild || [], {
      disableOpacity,
      antiAliasingShrink,
      realisticShading,
      photorealShading,
      aquarelleShading,
      revolutionSection,
      revolutionSectionByAxisId,
      revolutionSectionKey,
      revolutionSectionFill,
    });
    // The scene's annotation objects just changed: resync the drawing snap /
    // face-detection index. Deterministic counterpart of the 350 ms
    // post-commit bump in useDrawingPointerHandlers, which loses the race
    // when the liveQuery → resolve → load pipeline takes longer (a freshly
    // committed face's edges then silently never became snappable). The
    // rebuild itself only runs while the 3D drawing mode is active.
    dispatch(bumpSnapIndexEpoch());
    // Basemap groups are guaranteed to exist here (ensureBaseMapLoaded above):
    // re-run the child effects that attach objects to them (labels, cotes) —
    // on a fresh load landing directly on 3D their first run came too early.
    dispatch(bumpAnnotationsLoadTick());
  }, [
    rendererIsReady,
    isActiveViewer,
    annotations,
    annotationsForThreed,
    annotationsForBuild,
    threedEditor,
    disableOpacity,
    antiAliasingShrink,
    realisticShading,
    photorealShading,
    aquarelleShading,
    revolutionSectionKey,
    revolutionSectionFill,
    extraBaseMapIds,
    chipExtraBaseMapIds,
    baseMaps,
    mainBaseMap,
    gridPinned,
    gridDessin,
  ]);

  return annotationsForThreed;
}
