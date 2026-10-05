import { useEffect, useMemo, useRef, useState } from "react";

import { useDispatch, useSelector } from "react-redux";
import {
  BufferAttribute,
  BufferGeometry,
  FrontSide,
  Group,
  Mesh,
  MeshBasicMaterial,
} from "three";

import { setHighlightedMeshPaintId } from "Features/meshPaint/meshPaintSlice";

import { selectHiddenAnnotationTemplateIdSet } from "Features/scopeVisibility/selectors/scopeVisibilitySelectors";
import { selectLinkedListingSourceForSelectedScope } from "Features/listings/selectors/listingsSelectors";
import { selectPovFreezeCreatedBefore } from "Features/viewers/utils/effectiveViewerKey";
import selectSoloWorkPackageId from "Features/businessObjects/utils/selectSoloWorkPackageId";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useMeshCellRelations from "Features/annotations/hooks/useMeshCellRelations";
import useBusinessObjectSoloAnnotationIdSet from "Features/businessObjects/hooks/useBusinessObjectSoloAnnotationIdSet";
import useWorkPackageSoloAnnotationIdSet from "Features/businessObjects/hooks/useWorkPackageSoloAnnotationIdSet";
import useZoneSoloAnnotationIdSet from "Features/zonings/hooks/useZoneSoloAnnotationIdSet";
import useMeshPaints from "Features/meshPaint/hooks/useMeshPaints";

import {
  MESH3D_EDGE_SELECTED_WIDTH_PX,
  MESH3D_FACE_SELECTED_STIPPLE,
  MESH3D_PART_SELECTED_COLOR,
} from "Features/annotationMesh3d/constants/mesh3dPartColors";
import { buildMesh3dEdgeLines } from "Features/annotationMesh3d/services/pickMesh3dEdge";
import applyWorldBoxUVs from "Features/photorealRender/utils/applyWorldBoxUVs";
import ensureMaterial3dMaps from "Features/photorealRender/utils/ensureMaterial3dMaps";
import { makeMaterial } from "Features/threedEditor/js/utilsAnnotationsManager/createAnnotationObject3D";
import { buildStippleOverlayFromPositions } from "Features/threedEditor/js/utilsAnnotationsManager/faceHoverHighlight";
import getBaseMapForRender from "Features/threedEditor/js/utilsAnnotationsManager/getBaseMapForRender";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import {
  MESH_PAINT_PART_TYPES,
  MESH_PAINT_STATUS,
  PAINT_EDGE_RENDER_ORDER,
  PAINT_EDGE_WIDTH_PX,
  PAINT_FACE_LIFT_M,
  PAINT_FACE_RENDER_ORDER,
} from "Features/meshPaint/constants/meshPaintConstants";
import { getHostHalfView } from "Features/meshPaint/js/buildHostPartIndexFromObject";
import { setMeshPaintObjects } from "Features/meshPaint/js/meshPaintObjectsStore";
import focusMeshPaintInThreed from "Features/meshPaint/services/focusMeshPaintInThreed";
import clipPaintGeometry, {
  getClipKey,
} from "Features/meshPaint/utils/clipPaintGeometry";
import getMeshPaintMetrics from "Features/meshPaint/utils/getMeshPaintMetrics";
import getMeshPaintVisibility, {
  MESH_PAINT_VISIBILITY,
} from "Features/meshPaint/utils/getMeshPaintVisibility";
import { paintGeometryToLocal } from "Features/meshPaint/utils/meshPaintFrame";
import resolveMeshPaints from "Features/meshPaint/utils/resolveMeshPaints";
import triangulatePaintFace from "Features/meshPaint/utils/triangulatePaintFace";

// Look of a DIMMED paint (dimmed base map, solo elsewhere, orphan): the grey
// translucent override of the dimmed annotations (applyAnnotationMaterialState).
const DIM_COLOR = 0x888888;
const DIM_OPACITY = 0.3;

// A focus request whose paint is not displayed yet (rows / base map still
// loading) is honored when its object appears, within this delay — never
// minutes later out of the blue.
const FOCUS_REQUEST_TTL_MS = 5000;

const EMPTY_SET = new Set();

// Stored geometry → string, cached per geometry object (rows of one
// liveQuery emission are new objects, but unchanged ones keep a cheap key).
const geometryKeyCache = new WeakMap();
function getGeometryKey(geometry) {
  if (!geometry || typeof geometry !== "object") return "";
  let key = geometryKeyCache.get(geometry);
  if (key === undefined) {
    key = JSON.stringify(geometry);
    geometryKeyCache.set(geometry, key);
  }
  return key;
}

// Strip the alpha of #RRGGBBAA / #RGBA (THREE.Color takes #RRGGBB) — same
// rule as createAnnotationObject3D's normalizeHex.
function normalizeHex(hex) {
  if (typeof hex !== "string") return hex;
  if (hex.length === 9 && hex.startsWith("#")) return hex.slice(0, 7);
  if (hex.length === 5 && hex.startsWith("#")) return hex.slice(0, 4);
  return hex;
}

// Colour + opacity of a painted EDGE: the stroke-driven branch of
// makeMaterial (color3D first), opacity3D ?? 1 (a finish covers its host).
function getEdgeStyle(template, disableOpacity) {
  const color = normalizeHex(
    template?.color3D ||
      template?.strokeColor ||
      template?.fillColor ||
      "#cccccc"
  );
  const opacity = disableOpacity ? 1 : (template?.opacity3D ?? 1);
  return { color, opacity };
}

// The template fields makeMaterial reads for a painted FACE (fill-driven).
// opacity3D ?? 1: a coating covers its host (never the 2D fill opacity).
function getFaceMaterialSource(template) {
  return {
    type: "POLYGON",
    color3D: template?.color3D ?? null,
    fillColor: template?.fillColor ?? null,
    strokeColor: template?.strokeColor ?? null,
    opacity3D: template?.opacity3D ?? 1,
    material3d: template?.material3d ?? null,
  };
}

function syncClippingPlanes(material, planes) {
  if (!material) return;
  const next = planes && planes.length ? planes : null;
  if (material.clippingPlanes === next) return;
  const had = Boolean(material.clippingPlanes?.length);
  material.clippingPlanes = next;
  if (had !== Boolean(next)) material.needsUpdate = true;
}

// Renders the painted parts (« Pinceau », db.meshPaints) in the 3D viewer:
// one object per displayed paint, in a `userData.isPaintLayer` Group per base
// map attached under imagesManager.getGroup(baseMapId) — the base map pose,
// eye and moves apply for free, ClippingManager / the export / the scene box
// cover it as base map content. NEVER a child of the host's object: a paint
// stays visible when its host's template or listing is hidden, and the host's
// hover / dim must not tint it.
//
// - FACE: FrontSide skin (front = painted side) triangulated in its plane,
//   lifted PAINT_FACE_LIFT_M along its normal + polygon offset, material of
//   the painting template (makeMaterial, current render mode).
// - EDGE: thick screen-space line (buildMesh3dEdgeLines) in the template's
//   colour, exported as a polyline (userData.exportLine).
// - Visibility: getMeshPaintVisibility (own template / listing, host layer,
//   base map, POV, solos); ORPHAN and solo-excluded paints are dimmed,
//   CONFLICT losers are not drawn.
// - Highlight (meshPaint.highlightedPaintId): selected-part stipple / line,
//   shown even when the paint is otherwise HIDDEN; framed once per
//   meshPaint.focusNonce (focusMeshPaintInThreed).
//
// Displayed objects are published to meshPaintObjectsStore (brush picking,
// framing). Every GPU resource created here is disposed on rebuild / unmount.
export default function ThreedMeshPaints() {
  const dispatch = useDispatch();

  // data

  const { rows, hostById, listingById, loaded } = useMeshPaints();
  const annotationTemplates = useAnnotationTemplates();
  const { parentIdSet: meshCellParentIds } = useMeshCellRelations();

  const highlightedPaintId = useSelector((s) => s.meshPaint.highlightedPaintId);
  const focusNonce = useSelector((s) => s.meshPaint.focusNonce);

  // groups re-attach (loadMaps drops the base map groups without disposing
  // their non-basemap children)
  const annotationsLoadTick = useSelector(
    (s) => s.threedEditor.annotationsLoadTick
  );
  const baseMapsLoadTick = useSelector((s) => s.threedEditor.baseMapsLoadTick);

  // render options (same switches as the annotation objects)
  const renderMode = useSelector((s) => s.threedEditor.renderMode);
  const disableOpacity = useSelector((s) => s.threedEditor.disableOpacity);

  // visibility inputs (mirror of useAutoLoadAnnotationsInThreedEditor +
  // ThreedAnnotationsVisibility + ThreedSelectionDimmer)
  const mainBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const baseMapModeById = useSelector(
    (s) => s.threedEditor.annotationsModeByBaseMapIdIn3d
  );
  const hideAnnotationsIn3d = useSelector(
    (s) => s.threedEditor.hideAnnotationsIn3d
  );
  const hideMainBaseMapAnnotationsIn3d = useSelector(
    (s) => s.threedEditor.hideMainBaseMapAnnotationsIn3d
  );
  const hiddenTemplateIds = useSelector(selectHiddenAnnotationTemplateIdSet);
  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);
  const isBaseMapsModule = useSelector(
    (s) => s.viewers.selectedViewerKey === "BASE_MAPS"
  );
  const showAnnotationsInBaseMaps = useSelector(
    (s) => s.baseMapEditor.showAnnotations
  );
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const linkedListingSourceByListingId = useSelector(
    selectLinkedListingSourceForSelectedScope
  );
  const hiddenLayerIds = useSelector((s) => s.layers?.hiddenLayerIds);
  const showAnnotationsWithoutLayer = useSelector(
    (s) => s.layers?.showAnnotationsWithoutLayer ?? true
  );
  const povFreezeCreatedBefore = useSelector(selectPovFreezeCreatedBefore);
  const showMeshCells = useSelector((s) => s.annotations.showMeshCells);

  // solos (keepSoloDimmed semantics of the 3D viewer)
  const soloAnnotationTemplateId = useSelector(
    (s) => s.annotations?.soloAnnotationTemplateId ?? null
  );
  const soloAnnotationId = useSelector(
    (s) => s.annotations?.soloAnnotationId ?? null
  );
  const soloZone = useSelector((s) => s.zonings?.soloZone ?? null);
  const zoneSoloAnnotationIds = useZoneSoloAnnotationIdSet(soloZone?.zoneId);
  // Planning "Play" mode replaces the work-package solo (useAnnotationsV2).
  const playActive = useSelector((s) => Boolean(s.planning?.playActive));
  const soloWorkPackageIdRaw = useSelector(selectSoloWorkPackageId);
  const soloWorkPackageId = playActive ? null : soloWorkPackageIdRaw;
  const workPackageSoloAnnotationIds =
    useWorkPackageSoloAnnotationIdSet(soloWorkPackageId);
  const soloBusinessObjectId = useSelector(
    (s) => s.businessObjects?.soloBusinessObjectId ?? null
  );
  const businessObjectSoloAnnotationIds =
    useBusinessObjectSoloAnnotationIdSet(soloBusinessObjectId);

  // state

  const layersRef = useRef(new Map()); // baseMapId → Group (isPaintLayer)
  const entriesRef = useRef(new Map()); // paintId → {object, buildKey, materialKey}
  // Bumped when a painted host is rebuilt: its displayed side (half-view
  // revolution) may have changed.
  const [hostReadyTick, setHostReadyTick] = useState(0);
  const paintedHostIdsRef = useRef(new Set());
  const faceMaterialsRef = useRef(new Map()); // style key → shared material
  const dimFaceMaterialRef = useRef(null);
  const resolvedRef = useRef(null); // resolveMeshPaints cache
  const pendingFocusRef = useRef(null); // {id} awaiting its object
  const lastFocusNonceRef = useRef(focusNonce);

  // helpers

  const templateById = useMemo(() => {
    const byId = {};
    (annotationTemplates || []).forEach((template) => {
      if (template?.id) byId[template.id] = template;
    });
    return byId;
  }, [annotationTemplates]);

  const visibilityCtx = useMemo(
    () => ({
      mainBaseMapId,
      baseMapModeById,
      hideAnnotationsIn3d,
      hideMainBaseMapAnnotationsIn3d,
      hiddenTemplateIds,
      hiddenListingIds: new Set(hiddenListingsIds || []),
      listingById,
      isBaseMapsModule,
      showAnnotationsInBaseMaps,
      excludeProfileTemplates: true,
      scopeId,
      linkedListingIds: new Set(
        Object.keys(linkedListingSourceByListingId || {})
      ),
      hiddenLayerIds: new Set(hiddenLayerIds || []),
      showAnnotationsWithoutLayer,
      povFreezeCreatedBefore,
      showMeshCells,
      meshCellParentIds: meshCellParentIds ?? EMPTY_SET,
      soloAnnotationTemplateId,
      soloAnnotationId,
      soloZone,
      zoneSoloAnnotationIds,
      soloWorkPackageId,
      workPackageSoloAnnotationIds,
      soloBusinessObjectId,
      businessObjectSoloAnnotationIds,
    }),
    [
      mainBaseMapId,
      baseMapModeById,
      hideAnnotationsIn3d,
      hideMainBaseMapAnnotationsIn3d,
      hiddenTemplateIds,
      hiddenListingsIds,
      listingById,
      isBaseMapsModule,
      showAnnotationsInBaseMaps,
      scopeId,
      linkedListingSourceByListingId,
      hiddenLayerIds,
      showAnnotationsWithoutLayer,
      povFreezeCreatedBefore,
      showMeshCells,
      meshCellParentIds,
      soloAnnotationTemplateId,
      soloAnnotationId,
      soloZone,
      zoneSoloAnnotationIds,
      soloWorkPackageId,
      workPackageSoloAnnotationIds,
      soloBusinessObjectId,
      businessObjectSoloAnnotationIds,
    ]
  );

  // Shared materials are owned by the caches below: never disposed with the
  // objects that use them.
  function isSharedMaterial(material) {
    if (!material) return false;
    if (material === dimFaceMaterialRef.current) return true;
    for (const shared of faceMaterialsRef.current.values()) {
      if (shared === material) return true;
    }
    return false;
  }

  function disposeObject(object) {
    if (!object) return;
    object.parent?.remove(object);
    object.traverse((child) => {
      child.geometry?.dispose?.();
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      materials.forEach((material) => {
        if (material && !isSharedMaterial(material)) material.dispose?.();
      });
    });
  }

  function getDimFaceMaterial() {
    if (!dimFaceMaterialRef.current) {
      dimFaceMaterialRef.current = new MeshBasicMaterial({
        color: DIM_COLOR,
        transparent: true,
        opacity: DIM_OPACITY,
        depthWrite: false,
        side: FrontSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
    }
    return dimFaceMaterialRef.current;
  }

  function getFaceMaterial(template, sceneManager) {
    const source = getFaceMaterialSource(template);
    const key = JSON.stringify([source, renderMode, Boolean(disableOpacity)]);
    let material = faceMaterialsRef.current.get(key);
    if (!material) {
      material = makeMaterial(source, {
        disableOpacity,
        realisticShading:
          renderMode === "REALISTIC" || renderMode === "PHOTOREAL",
        photorealShading: renderMode === "PHOTOREAL",
        aquarelleShading: renderMode === "AQUARELLE",
        onAsyncLoaded: () => sceneManager.requestRender?.(),
      });
      // Single-sided: only the painted side shows (the other side of a thin
      // host keeps its own colour / paint). The back-face darkening of the
      // Lambert branch is inert on front faces.
      material.side = FrontSide;
      material.polygonOffset = true;
      material.polygonOffsetFactor = -1;
      material.polygonOffsetUnits = -1;
      material.needsUpdate = true;
      faceMaterialsRef.current.set(key, material);
    }
    return { material, key };
  }

  function buildFaceObject({
    row,
    template,
    metrics,
    clip,
    dimmed,
    highlighted,
    sceneManager,
  }) {
    const localFace = paintGeometryToLocal(
      MESH_PAINT_PART_TYPES.FACE,
      row.geometry,
      metrics
    );
    if (!localFace?.polygons?.length) return null;
    // Only the displayed side (host shown as a half revolution).
    const displayed = clipPaintGeometry(
      MESH_PAINT_PART_TYPES.FACE,
      localFace,
      clip
    );
    if (!displayed) return null;
    const { positions, normals } = triangulatePaintFace(displayed, {
      lift: PAINT_FACE_LIFT_M,
    });
    if (!positions?.length) return null;

    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new BufferAttribute(normals, 3));

    let materialKey = null;
    let material;
    if (dimmed) {
      material = getDimFaceMaterial();
    } else {
      const result = getFaceMaterial(template, sceneManager);
      material = result.material;
      materialKey = result.key;
    }

    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = PAINT_FACE_RENDER_ORDER;
    mesh.raycast = () => {};
    if (!dimmed && renderMode === "PHOTOREAL") {
      mesh.receiveShadow = true;
      if (material.userData?.material3dNeedsBoxUvs) {
        applyWorldBoxUVs(mesh);
        ensureMaterial3dMaps(material, () => sceneManager.requestRender?.());
      }
    }

    if (highlighted) {
      // Copy: the overlay must not share the paint's position array.
      const overlay = buildStippleOverlayFromPositions(
        Float32Array.from(positions),
        MESH3D_FACE_SELECTED_STIPPLE
      );
      if (overlay) mesh.add(overlay);
    }

    return {
      object: mesh,
      materialKey,
      localGeometry: localFace,
      localNormal: localFace.normal,
    };
  }

  function buildEdgeObject({
    row,
    template,
    metrics,
    clip,
    dimmed,
    highlighted,
    domElement,
  }) {
    const localEdge = paintGeometryToLocal(
      MESH_PAINT_PART_TYPES.EDGE,
      row.geometry,
      metrics
    );
    // One line segment per displayed segment of the edge (a curve has
    // several; host shown as a half revolution: its displayed side only).
    const points = localEdge?.points ?? [];
    const displayed = clipPaintGeometry(
      MESH_PAINT_PART_TYPES.EDGE,
      localEdge,
      clip
    );
    if (!displayed) return null;
    const positions = displayed.segments.flatMap(([a, b]) => [
      a.x,
      a.y,
      a.z,
      b.x,
      b.y,
      b.z,
    ]);
    if (!positions.every(Number.isFinite)) return null;

    const style = dimmed
      ? { color: DIM_COLOR, opacity: DIM_OPACITY }
      : getEdgeStyle(template, disableOpacity);
    const line = buildMesh3dEdgeLines(positions, {
      color: style.color,
      linewidth: PAINT_EDGE_WIDTH_PX,
      domElement,
    });
    // A paint, not a transient hover helper: exported, never raycast
    // (buildMesh3dEdgeLines already disables raycast). LineMaterial.resolution
    // follows the canvas on its own (LineSegments2.onBeforeRender).
    delete line.userData.isHoverOverlay;
    line.renderOrder = PAINT_EDGE_RENDER_ORDER;
    // Exported as ONE polyline (consecutive points, not segment pairs).
    line.userData.exportLine = {
      positions: points.flatMap((p) => [p.x, p.y, p.z]),
    };
    if (style.opacity < 1) {
      line.material.transparent = true;
      line.material.opacity = style.opacity;
    }

    if (highlighted) {
      line.add(
        buildMesh3dEdgeLines(positions, {
          color: MESH3D_PART_SELECTED_COLOR,
          linewidth: MESH3D_EDGE_SELECTED_WIDTH_PX,
          domElement,
        })
      );
    }

    return {
      object: line,
      materialKey: null,
      localGeometry: localEdge,
      localNormal: null,
    };
  }

  function getResolvedItems(imagesManager) {
    const metricsByBaseMapId = {};
    Object.entries(imagesManager.baseMapsMap || {}).forEach(([id, baseMap]) => {
      const metrics = getMeshPaintMetrics(baseMap);
      if (metrics) metricsByBaseMapId[id] = metrics;
    });
    const metricsKey = JSON.stringify(metricsByBaseMapId);
    const cache = resolvedRef.current;
    if (
      cache &&
      cache.rows === rows &&
      cache.hostById === hostById &&
      cache.listingById === listingById &&
      cache.templateById === templateById &&
      cache.metricsKey === metricsKey
    ) {
      return cache.items;
    }
    const { items } =
      resolveMeshPaints({
        rows,
        hostById,
        templateById,
        listingById,
        metricsByBaseMapId,
      }) ?? {};
    resolvedRef.current = {
      rows,
      hostById,
      listingById,
      templateById,
      metricsKey,
      items: items ?? [],
    };
    return resolvedRef.current.items;
  }

  function tryPendingFocus() {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    if (
      pending.id !== highlightedPaintId ||
      Date.now() - pending.requestedAt > FOCUS_REQUEST_TTL_MS
    ) {
      pendingFocusRef.current = null;
      return;
    }
    if (!entriesRef.current.has(pending.id)) return; // wait for its object
    pendingFocusRef.current = null;
    focusMeshPaintInThreed(pending.id).catch((e) =>
      console.error("[ThreedMeshPaints] focus failed", e)
    );
  }

  // effects

  useEffect(() => {
    paintedHostIdsRef.current = new Set(
      rows.map((row) => row.hostAnnotationId)
    );
  }, [rows]);

  // Rebuilt painted hosts: the clip of their paints is read again.
  useEffect(() => {
    const annotationsManager =
      getActiveThreedEditor()?.sceneManager?.annotationsManager;
    return annotationsManager?.subscribeAnnotationReady?.((ids) => {
      if ((ids || []).some((id) => paintedHostIdsRef.current.has(id))) {
        setHostReadyTick((tick) => tick + 1);
      }
    });
  }, []);

  // Unmount: dispose everything (objects, layers, shared materials).
  useEffect(() => {
    return () => {
      // Objects first: disposeObject skips the shared materials, which are
      // still registered at this point.
      entriesRef.current.forEach((entry) => disposeObject(entry.object));
      entriesRef.current = new Map();
      layersRef.current.forEach((layer) => layer.parent?.remove(layer));
      layersRef.current = new Map();
      faceMaterialsRef.current.forEach((material) => material.dispose?.());
      faceMaterialsRef.current = new Map();
      dimFaceMaterialRef.current?.dispose?.();
      dimFaceMaterialRef.current = null;
      resolvedRef.current = null;
      setMeshPaintObjects(new Map());
      getActiveThreedEditor()?.sceneManager?.requestRender?.();
    };
  }, []);

  // (Re)build pass: diff the displayed paints against the built objects.
  useEffect(() => {
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const imagesManager = sceneManager?.imagesManager;
    if (!imagesManager) return;

    const items = getResolvedItems(imagesManager);
    const clippingManager = sceneManager.clippingManager;
    const clippingPlanes = clippingManager?.enabled
      ? clippingManager.planes
      : null;
    const domElement = sceneManager.renderer?.domElement;

    const prevEntries = entriesRef.current;
    const nextEntries = new Map();
    const usedMaterialKeys = new Set();
    const published = new Map();

    for (const item of items) {
      const row = item?.row;
      if (!row?.id) continue;
      const highlighted = row.id === highlightedPaintId;
      const visibility = getMeshPaintVisibility(item, visibilityCtx);
      if (visibility === MESH_PAINT_VISIBILITY.HIDDEN && !highlighted) continue;

      const group = imagesManager.getGroup?.(row.baseMapId);
      const baseMap = imagesManager.baseMapsMap?.[row.baseMapId];
      // Not in the scene (yet): the next load tick retries.
      if (!group || !baseMap) continue;
      // The frame the hosts are drawn in (AnnotationsManager).
      const metrics = getBaseMapForRender(baseMap);
      if (!metrics) continue;

      // A highlighted paint forced on screen keeps the dim look of a
      // non-counted part (orphan, conflict loser).
      const dimmed =
        visibility === MESH_PAINT_VISIBILITY.DIMMED ||
        (visibility === MESH_PAINT_VISIBILITY.HIDDEN &&
          item.status !== MESH_PAINT_STATUS.OK);
      // Host shown as a display-only half revolution: the paint covers the
      // full turn, only its displayed side is drawn.
      const clip = getHostHalfView(
        sceneManager.annotationsManager?.annotationsObjectsMap?.[
          row.hostAnnotationId
        ],
        group
      );
      const template = item.template;
      const styleKey =
        row.partType === MESH_PAINT_PART_TYPES.EDGE
          ? JSON.stringify(getEdgeStyle(template, disableOpacity))
          : JSON.stringify([
              getFaceMaterialSource(template),
              renderMode,
              Boolean(disableOpacity),
            ]);
      const buildKey = [
        row.partType,
        row.baseMapId,
        row.sync?.syncedAt ?? "",
        getGeometryKey(row.geometry),
        `${metrics.imageWidth}x${metrics.imageHeight}@${metrics.meterByPx}`,
        styleKey,
        getClipKey(clip),
        dimmed ? "dim" : "",
        highlighted ? "hl" : "",
      ].join("|");

      let entry = prevEntries.get(row.id);
      if (!entry || entry.buildKey !== buildKey) {
        const args = {
          row,
          template,
          metrics,
          clip,
          dimmed,
          highlighted,
          sceneManager,
          domElement,
        };
        const built =
          row.partType === MESH_PAINT_PART_TYPES.EDGE
            ? buildEdgeObject(args)
            : row.partType === MESH_PAINT_PART_TYPES.FACE
              ? buildFaceObject(args)
              : null;
        if (!built) continue;
        built.object.traverse((child) => {
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          materials.forEach((material) =>
            syncClippingPlanes(material, clippingPlanes)
          );
        });
        entry = {
          object: built.object,
          buildKey,
          materialKey: built.materialKey,
        };
        Object.assign(built.object.userData, {
          localGeometry: built.localGeometry,
          localNormal: built.localNormal,
          clip,
        });
      }

      Object.assign(entry.object.userData, {
        isPaintOverlay: true,
        meshPaintId: row.id,
        partType: row.partType,
        annotationTemplateId: row.annotationTemplateId,
        hostAnnotationId: row.hostAnnotationId,
        baseMapId: row.baseMapId,
        visibility,
        status: item.status,
      });
      entry.object.name = `MeshPaint-${row.id}`;

      let layer = layersRef.current.get(row.baseMapId);
      if (!layer) {
        layer = new Group();
        layer.name = `MeshPaints-${row.baseMapId}`;
        layer.userData = { isPaintLayer: true, baseMapId: row.baseMapId };
        layersRef.current.set(row.baseMapId, layer);
      }
      if (entry.object.parent !== layer) layer.add(entry.object);

      nextEntries.set(row.id, entry);
      published.set(row.id, entry.object);
      if (entry.materialKey) usedMaterialKeys.add(entry.materialKey);
    }

    // Objects no longer displayed.
    prevEntries.forEach((entry, id) => {
      if (nextEntries.get(id) !== entry) disposeObject(entry.object);
    });
    entriesRef.current = nextEntries;

    // Layers: (re)attached to the CURRENT base map group, detached when
    // empty (an empty child would keep ImagesManager.removeUntexturedGroup
    // from dropping a placeholder group).
    layersRef.current.forEach((layer, baseMapId) => {
      const group = imagesManager.getGroup?.(baseMapId);
      if (!group || layer.children.length === 0) {
        layer.parent?.remove(layer);
        return;
      }
      if (layer.parent !== group) group.add(layer);
    });

    // Shared face materials no longer used by any object.
    faceMaterialsRef.current.forEach((material, key) => {
      if (usedMaterialKeys.has(key)) {
        syncClippingPlanes(material, clippingPlanes);
        return;
      }
      faceMaterialsRef.current.delete(key);
      material.dispose?.();
    });
    syncClippingPlanes(dimFaceMaterialRef.current, clippingPlanes);

    setMeshPaintObjects(published);
    sceneManager.requestRender?.();
    tryPendingFocus();
  }, [
    rows,
    hostById,
    listingById,
    templateById,
    visibilityCtx,
    renderMode,
    disableOpacity,
    highlightedPaintId,
    annotationsLoadTick,
    baseMapsLoadTick,
    hostReadyTick,
  ]);

  // Focus request from the panel (one per nonce bump).
  useEffect(() => {
    if (lastFocusNonceRef.current === focusNonce) return;
    lastFocusNonceRef.current = focusNonce;
    if (!highlightedPaintId) return;
    pendingFocusRef.current = {
      id: highlightedPaintId,
      requestedAt: Date.now(),
    };
    tryPendingFocus();
  }, [focusNonce]);

  // The highlighted paint is gone (deleted, other project): clear it.
  useEffect(() => {
    if (!loaded || !highlightedPaintId) return;
    if (rows.some((row) => row.id === highlightedPaintId)) return;
    dispatch(setHighlightedMeshPaintId(null));
  }, [loaded, rows, highlightedPaintId]);

  // render

  return null;
}
