import { createSlice } from "@reduxjs/toolkit";

const threedEditorInitialState = {
  showGrid: true,
  // When true, annotation materials ignore `annotation.opacity` and render
  // fully opaque. Exposed as the "Transparence des annotations" switch.
  disableOpacity: true,
  // When true, CM-width POLYLINE footprints are contracted by 5 mm before
  // extrusion to avoid coplanar-face aliasing when a parement abuts a wall.
  antiAliasingShrink: true,
  // "NAVIGATION" | "SELECTION" | "BASEMAP_POSITION".
  // - NAVIGATION: shift+drag = camera (OrbitControls).
  // - SELECTION: shift+drag = lasso selection.
  // - BASEMAP_POSITION: shows the position/rotation panel + transform gizmo
  //   for the selected basemap. Annotation creation and lasso are blocked.
  editorMode: "NAVIGATION",
  // Vertical offset (in meters along the basemap's local normal) applied to
  // newly drawn annotations. Set from the basemap-position panel; consumed
  // by the annotation creation flow so a user can stack new annotations
  // above the floor without a per-annotation offsetZ tweak.
  drawingOffset: 0,
  // 3D-only basemap opacity (0..1). Independent from baseMap.opacity (DB)
  // and from mapEditor.baseMapOpacity (2D). Resets to 1 on every reload.
  baseMapOpacityIn3d: 1,
  // Base maps explicitly shown in the 3D scene *in addition to* the main
  // (selected) base map, which is always loaded. Session-only, resets on
  // every reload — same lifecycle as `baseMapOpacityIn3d`.
  visibleBaseMapIdsIn3d: [],
  // Per-base-map annotation display mode in the 3D scene, keyed by baseMapId.
  // Value "NORMAL" | "DIMMED"; a missing key means "NONE" (no annotations).
  // Independent from `visibleBaseMapIdsIn3d` (the image-eye toggle): a base
  // map's annotations can show even when its image is hidden. The main
  // (selected) base map is not stored here — its annotations are always shown
  // and driven by the selection dimmer. Session-only, resets on every reload.
  annotationsModeByBaseMapIdIn3d: {},
  // Fire-and-forget cross-tab event: pan the 3D camera to a world-space
  // point. `triggeredAt` makes repeated clicks at the same spot still fire.
  // `baseMapId` is a guard: the consumer ignores the event when its current
  // basemap differs (frames may not match across baseMaps).
  navigateToWorldPoint: null, // { baseMapId, worldX, worldY, worldZ, triggeredAt }
  // Fire-and-forget cross-tab event: select an annotation in the 3D tab, so a
  // "Nav" click in the 2D tab also brings the object into the 3D selection
  // (only if it isn't already selected there). `triggeredAt` makes repeated
  // requests for the same annotation still fire.
  selectAnnotationInThreed: null, // { annotationId, annotationType, listingId, triggeredAt }
  // 3D drawing mode: vertex-snapped polylines that auto-commit to a 2D
  // annotation when a closed coplanar face is detected.
  drawingMode: {
    active: false,
    // Vertices clicked since the last face-commit / Enter / Esc.
    inProgressPolyline: [], // [{x, y, z}]
    // Persistent 3D wireframe segments (memory-only v1). Produced by Enter,
    // consumed when a face closes against them.
    trait3DSegments: [], // [{a:{x,y,z}, b:{x,y,z}}]
    // Auto-detected dominant world axis when Shift is held during
    // mouse-move; null otherwise.
    axisLock: null, // null | "X" | "Y" | "Z"
    // Bumped each time a face is committed, so useVertexSnap rebuilds the
    // mesh-vertex + mesh-edge index to include the freshly-rendered
    // annotation. The bump fires after a small delay to give the
    // db → liveQuery → AnnotationsManager pipeline time to add the new
    // mesh to the scene.
    snapIndexEpoch: 0,
  },
  // Move mode: select an annotation and translate it along the baseMap
  // normal via a gizmo + numeric field. Mutually exclusive with
  // `drawingMode.active`.
  moveMode: {
    active: false,
    // Annotation currently being moved (id from db.annotations).
    selectedAnnotationId: null,
    // Live delta in meters along the baseMap-local Z axis, mirrored from
    // the gizmo and from the numeric field.
    deltaZ: 0,
    // Snapshot of the active sub-selection at "Move" click time. When set,
    // the gizmo targets the centroid of the listed pointIds (single vertex
    // or edge midpoint) and writes the delta to per-point offsetTop instead
    // of the annotation-wide offsetZ.
    // Shape: { annotationId, kind: 'VERTEX'|'EDGE', pointIds, vertexIndex }
    subSelectionTarget: null,
  },
  // Sub-selection inside the currently-selected annotation (vertex or edge).
  // Populated when the user clicks a vertex / edge of an already-selected
  // annotation. Cleared when the user clicks elsewhere on the same face or
  // selects another annotation.
  subSelection: {
    annotationId: null,
    kind: null, // 'VERTEX' | 'EDGE'
    pointIds: [], // [pointId] for VERTEX, [pidA, pidB] for EDGE
    vertexIndex: null, // index in annotation.points[] (for label)
    // For EDGE: second vertex index (vertexIndex == first one).
    vertexIndexB: null,
  },
};

export const threedEditorSlice = createSlice({
  name: "threedEditor",
  initialState: threedEditorInitialState,
  reducers: {
    setShowGrid: (state, action) => {
      state.showGrid = action.payload;
    },
    setDisableOpacity: (state, action) => {
      state.disableOpacity = action.payload;
    },
    setAntiAliasingShrink: (state, action) => {
      state.antiAliasingShrink = action.payload;
    },
    setEditorMode: (state, action) => {
      state.editorMode = action.payload;
    },
    setDrawingOffset: (state, action) => {
      state.drawingOffset = action.payload;
    },
    setBaseMapOpacityIn3d: (state, action) => {
      state.baseMapOpacityIn3d = action.payload;
    },
    toggleBaseMapVisibleIn3d: (state, action) => {
      const id = action.payload;
      const i = state.visibleBaseMapIdsIn3d.indexOf(id);
      if (i === -1) {
        state.visibleBaseMapIdsIn3d.push(id);
      } else {
        state.visibleBaseMapIdsIn3d.splice(i, 1);
      }
    },
    setBaseMapAnnotationsModeIn3d: (state, action) => {
      const { baseMapId, mode } = action.payload || {};
      if (!baseMapId) return;
      if (!mode || mode === "NONE") {
        delete state.annotationsModeByBaseMapIdIn3d[baseMapId];
      } else {
        state.annotationsModeByBaseMapIdIn3d[baseMapId] = mode;
      }
    },
    setNavigateToWorldPoint: (state, action) => {
      state.navigateToWorldPoint = action.payload;
    },
    setSelectAnnotationInThreed: (state, action) => {
      state.selectAnnotationInThreed = action.payload;
    },
    setDrawingModeActive: (state, action) => {
      state.drawingMode.active = action.payload;
      if (!action.payload) {
        state.drawingMode.inProgressPolyline = [];
        state.drawingMode.trait3DSegments = [];
        state.drawingMode.axisLock = null;
        state.drawingMode.snapIndexEpoch = 0;
      } else {
        // Mutually exclusive with move mode.
        state.moveMode.active = false;
        state.moveMode.selectedAnnotationId = null;
        state.moveMode.deltaZ = 0;
      }
    },
    bumpSnapIndexEpoch: (state) => {
      state.drawingMode.snapIndexEpoch += 1;
    },
    setMoveModeActive: (state, action) => {
      state.moveMode.active = action.payload;
      if (!action.payload) {
        state.moveMode.selectedAnnotationId = null;
        state.moveMode.deltaZ = 0;
        state.moveMode.subSelectionTarget = null;
      } else {
        // Mutually exclusive with drawing mode.
        state.drawingMode.active = false;
        state.drawingMode.inProgressPolyline = [];
        state.drawingMode.trait3DSegments = [];
        state.drawingMode.axisLock = null;
      }
    },
    setMoveSelectedAnnotationId: (state, action) => {
      state.moveMode.selectedAnnotationId = action.payload;
      state.moveMode.deltaZ = 0;
    },
    setMoveDeltaZ: (state, action) => {
      state.moveMode.deltaZ = action.payload;
    },
    setMoveSubSelectionTarget: (state, action) => {
      state.moveMode.subSelectionTarget = action.payload;
      if (action.payload) {
        // Auto-set the moved annotation id so MoveGizmoThreed picks it up.
        state.moveMode.selectedAnnotationId = action.payload.annotationId;
        state.moveMode.deltaZ = 0;
      }
    },
    setSubSelection: (state, action) => {
      const p = action.payload || {};
      state.subSelection.annotationId = p.annotationId ?? null;
      state.subSelection.kind = p.kind ?? null;
      state.subSelection.pointIds = p.pointIds ?? [];
      state.subSelection.vertexIndex = p.vertexIndex ?? null;
      state.subSelection.vertexIndexB = p.vertexIndexB ?? null;
    },
    clearSubSelection: (state) => {
      state.subSelection.annotationId = null;
      state.subSelection.kind = null;
      state.subSelection.pointIds = [];
      state.subSelection.vertexIndex = null;
      state.subSelection.vertexIndexB = null;
    },
    pushDrawingVertex: (state, action) => {
      state.drawingMode.inProgressPolyline.push(action.payload);
    },
    cancelInProgressPolyline: (state) => {
      state.drawingMode.inProgressPolyline = [];
      state.drawingMode.axisLock = null;
    },
    flushInProgressAsTrait3D: (state) => {
      const pts = state.drawingMode.inProgressPolyline;
      for (let i = 0; i < pts.length - 1; i++) {
        state.drawingMode.trait3DSegments.push({ a: pts[i], b: pts[i + 1] });
      }
      state.drawingMode.inProgressPolyline = [];
      state.drawingMode.axisLock = null;
    },
    consumeFaceSegments: (state, action) => {
      // payload: array of {a:{x,y,z}, b:{x,y,z}} to remove from trait3DSegments.
      // The in-progress polyline is reset entirely (face just committed).
      const consumed = action.payload || [];
      const isSame = (s1, s2) => {
        const eq = (p, q) =>
          Math.abs(p.x - q.x) < 1e-6 &&
          Math.abs(p.y - q.y) < 1e-6 &&
          Math.abs(p.z - q.z) < 1e-6;
        return (
          (eq(s1.a, s2.a) && eq(s1.b, s2.b)) ||
          (eq(s1.a, s2.b) && eq(s1.b, s2.a))
        );
      };
      state.drawingMode.trait3DSegments =
        state.drawingMode.trait3DSegments.filter(
          (seg) => !consumed.some((c) => isSame(seg, c))
        );
      state.drawingMode.inProgressPolyline = [];
      state.drawingMode.axisLock = null;
    },
    setDrawingAxisLock: (state, action) => {
      state.drawingMode.axisLock = action.payload;
    },
  },
});

export const {
  setShowGrid,
  setDisableOpacity,
  setAntiAliasingShrink,
  setEditorMode,
  setDrawingOffset,
  setBaseMapOpacityIn3d,
  toggleBaseMapVisibleIn3d,
  setBaseMapAnnotationsModeIn3d,
  setNavigateToWorldPoint,
  setSelectAnnotationInThreed,
  setDrawingModeActive,
  pushDrawingVertex,
  cancelInProgressPolyline,
  flushInProgressAsTrait3D,
  consumeFaceSegments,
  setDrawingAxisLock,
  bumpSnapIndexEpoch,
  setMoveModeActive,
  setMoveSelectedAnnotationId,
  setMoveDeltaZ,
  setMoveSubSelectionTarget,
  setSubSelection,
  clearSubSelection,
} = threedEditorSlice.actions;

export default threedEditorSlice.reducer;
