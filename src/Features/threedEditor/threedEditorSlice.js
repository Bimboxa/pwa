import { createSlice } from "@reduxjs/toolkit";

const threedEditorInitialState = {
  showGrid: true,
  // When true, annotation materials ignore `annotation.opacity` and render
  // fully opaque. Exposed as the "Transparence des annotations" switch.
  disableOpacity: true,
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
  // Fire-and-forget cross-tab event: pan the 3D camera to a world-space
  // point. `triggeredAt` makes repeated clicks at the same spot still fire.
  // `baseMapId` is a guard: the consumer ignores the event when its current
  // basemap differs (frames may not match across baseMaps).
  navigateToWorldPoint: null, // { baseMapId, worldX, worldY, worldZ, triggeredAt }
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
    setEditorMode: (state, action) => {
      state.editorMode = action.payload;
    },
    setDrawingOffset: (state, action) => {
      state.drawingOffset = action.payload;
    },
    setBaseMapOpacityIn3d: (state, action) => {
      state.baseMapOpacityIn3d = action.payload;
    },
    setNavigateToWorldPoint: (state, action) => {
      state.navigateToWorldPoint = action.payload;
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
  setEditorMode,
  setDrawingOffset,
  setBaseMapOpacityIn3d,
  setNavigateToWorldPoint,
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
} = threedEditorSlice.actions;

export default threedEditorSlice.reducer;
