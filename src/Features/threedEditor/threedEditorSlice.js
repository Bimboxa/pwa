import { createSlice } from "@reduxjs/toolkit";

const threedEditorInitialState = {
  showGrid: false,
  // When true, basemap images are hidden in the live 3D view AND omitted from
  // the 3D scene export (USDZ / OBJ) — annotation objects are unaffected.
  hideBaseMaps: false,
  // When true, annotation materials ignore `annotation.opacity` and render
  // fully opaque. Exposed as the "Transparence des annotations" switch.
  disableOpacity: true,
  // When true, CM-width POLYLINE footprints are contracted by 5 mm before
  // extrusion to avoid coplanar-face aliasing when a parement abuts a wall.
  antiAliasingShrink: true,
  // Viewport render mode (session-only). "STANDARD" = the historical unlit /
  // Lambert look. "REALISTIC" = real-time PBR: physical materials, white
  // environment lighting, shadows, ACES tone mapping. "PHOTOREAL" = the
  // REALISTIC setup plus progressive path tracing in the viewport (raster
  // fallback while the camera moves, converges when idle). Incompatible with
  // the clipping plane (the path tracer ignores clippingPlanes), so enabling
  // the plane drops PHOTOREAL back to REALISTIC.
  renderMode: "STANDARD",
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
  // Per-baseMap 3D opacity override (0..1), keyed by baseMapId. A missing key
  // means `baseMapOpacityIn3d` applies. Set from the baseMap properties panel
  // (opacity section in the 3D viewer) so the slider only affects the
  // selected baseMap. Session-only, same lifecycle as `baseMapOpacityIn3d`.
  opacityByBaseMapIdIn3d: {},
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
  // Main (selected) base map hide flags — the main base map defaults to fully
  // visible, so unlike the opt-in fields above these are opt-out. Both reset
  // to false whenever the main base map changes (see extraReducers).
  hideMainBaseMapImageIn3d: false,
  hideMainBaseMapAnnotationsIn3d: false,
  // Fire-and-forget cross-tab event: pan the 3D camera to a world-space
  // point. `triggeredAt` makes repeated clicks at the same spot still fire.
  // `baseMapId` is a guard: the consumer ignores the event when its current
  // basemap differs (frames may not match across baseMaps).
  navigateToWorldPoint: null, // { baseMapId, worldX, worldY, worldZ, triggeredAt }
  // Fire-and-forget cross-tab event: select an annotation in the 3D tab, so a
  // "Nav" click in the 2D tab also brings the object into the 3D selection
  // (only if it isn't already selected there). `triggeredAt` makes repeated
  // requests for the same annotation still fire.
  selectAnnotationInThreed: null, // { annotationId, annotationType, listingId, annotationTemplateId, triggeredAt }
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
  // Single clipping plane (session-only). `enabled` = plane applied to the
  // annotation/basemap materials; `editing` = panel + draggable gizmo shown.
  // The plane geometry itself lives in ClippingManager (three.js side).
  clippingPlane: {
    enabled: false,
    editing: false,
  },
  // Dimension ("cote") tool: click two mesh-snapped points to create a 3D
  // distance measurement. Mutually exclusive with `drawingMode.active` and
  // `moveMode.active`.
  dimensionMode: {
    active: false,
    // First clicked endpoint, world space, while the second is pending.
    startPoint: null, // {x, y, z} | null
  },
  // Meshing ("maillage") mode: create mailles from hovered faces and cut
  // them with vertical / horizontal / free lines. Mutually exclusive with
  // `drawingMode.active`, `moveMode.active` and `dimensionMode.active`.
  // Hide the annotations from the 3D scene (Panel Maillage toggle) — leaves
  // only basemaps + mailles visible (and lasso-selectable).
  hideAnnotationsIn3d: false,
  // Maille label cards ("étiquettes") display options (Panel Maillage).
  // Selected mailles always show number + surface regardless.
  mesh3dLabels: {
    visible: true,
    showNumber: true,
    showQties: false,
  },
  meshingMode: {
    active: false,
    tool: "SELECT", // "SELECT" | "CUT_VERTICAL" | "CUT_HORIZONTAL" | "CUT_FREE" | "CUT_POLYLINE"
    // "Décalage": distance (m) from the reference vertex to the guide vertex
    // used by the vertical / horizontal cut tools.
    offset: 2,
    // Side of the maille the reference vertex is picked on. Default LEFT
    // (resp. BOTTOM for horizontal cuts), flipped with the "S" key.
    cutSide: "LEFT", // "LEFT" | "RIGHT"
    // Fun sub-mode: Doom-like concrete-projection lance. While on, the cut
    // tools are suspended and a click sprays concrete toward the cursor.
    shootActive: false,
  },
  // First-person walk mode (W in the 3D viewer). Camera-controls suspended:
  // pointer-locked mouse looks, arrow keys move on the selected baseMap,
  // Space fires the concrete lance at the screen center.
  walkMode: {
    active: false,
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
    setHideBaseMaps: (state, action) => {
      state.hideBaseMaps = action.payload;
    },
    setDisableOpacity: (state, action) => {
      state.disableOpacity = action.payload;
    },
    setAntiAliasingShrink: (state, action) => {
      state.antiAliasingShrink = action.payload;
    },
    setRenderMode: (state, action) => {
      state.renderMode = action.payload;
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
    setBaseMapOpacityByIdIn3d: (state, action) => {
      const { baseMapId, opacity } = action.payload || {};
      if (!baseMapId) return;
      if (opacity == null) {
        delete state.opacityByBaseMapIdIn3d[baseMapId];
      } else {
        state.opacityByBaseMapIdIn3d[baseMapId] = opacity;
      }
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
    setVisibleBaseMapIdsIn3d: (state, action) => {
      state.visibleBaseMapIdsIn3d = action.payload ?? [];
    },
    setHideMainBaseMapImageIn3d: (state, action) => {
      state.hideMainBaseMapImageIn3d = Boolean(action.payload);
    },
    setHideMainBaseMapAnnotationsIn3d: (state, action) => {
      state.hideMainBaseMapAnnotationsIn3d = Boolean(action.payload);
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
    toggleMainBaseMapImageIn3d: (state) => {
      state.hideMainBaseMapImageIn3d = !state.hideMainBaseMapImageIn3d;
    },
    toggleMainBaseMapAnnotationsIn3d: (state) => {
      state.hideMainBaseMapAnnotationsIn3d =
        !state.hideMainBaseMapAnnotationsIn3d;
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
        // Mutually exclusive with move mode and dimension mode.
        state.moveMode.active = false;
        state.moveMode.selectedAnnotationId = null;
        state.moveMode.deltaZ = 0;
        state.dimensionMode.active = false;
        state.dimensionMode.startPoint = null;
        state.meshingMode.active = false;
        state.meshingMode.tool = "SELECT";
        state.meshingMode.shootActive = false;
        state.walkMode.active = false;
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
        // Mutually exclusive with drawing, dimension and meshing modes.
        state.drawingMode.active = false;
        state.drawingMode.inProgressPolyline = [];
        state.drawingMode.trait3DSegments = [];
        state.drawingMode.axisLock = null;
        state.dimensionMode.active = false;
        state.dimensionMode.startPoint = null;
        state.meshingMode.active = false;
        state.meshingMode.tool = "SELECT";
        state.meshingMode.shootActive = false;
        state.walkMode.active = false;
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
    setClippingPlaneEnabled: (state, action) => {
      state.clippingPlane.enabled = action.payload;
      if (!action.payload) state.clippingPlane.editing = false;
      // The path tracer ignores clippingPlanes — a traced view would silently
      // show the uncut geometry. Drop to the raster realistic mode instead.
      if (action.payload && state.renderMode === "PHOTOREAL")
        state.renderMode = "REALISTIC";
    },
    setClippingPlaneEditing: (state, action) => {
      state.clippingPlane.editing = action.payload;
      // Opening the editor implicitly creates/enables the plane.
      if (action.payload) state.clippingPlane.enabled = true;
      if (action.payload && state.renderMode === "PHOTOREAL")
        state.renderMode = "REALISTIC";
    },
    toggleClippingPlaneEditing: (state) => {
      const next = !state.clippingPlane.editing;
      state.clippingPlane.editing = next;
      if (next) state.clippingPlane.enabled = true;
      if (next && state.renderMode === "PHOTOREAL")
        state.renderMode = "REALISTIC";
    },
    setDimensionModeActive: (state, action) => {
      state.dimensionMode.active = action.payload;
      if (!action.payload) {
        state.dimensionMode.startPoint = null;
      } else {
        // Mutually exclusive with drawing, move and meshing modes.
        state.drawingMode.active = false;
        state.drawingMode.inProgressPolyline = [];
        state.drawingMode.trait3DSegments = [];
        state.drawingMode.axisLock = null;
        state.moveMode.active = false;
        state.moveMode.selectedAnnotationId = null;
        state.moveMode.deltaZ = 0;
        state.meshingMode.active = false;
        state.meshingMode.tool = "SELECT";
        state.meshingMode.shootActive = false;
        state.walkMode.active = false;
      }
    },
    setDimensionStartPoint: (state, action) => {
      state.dimensionMode.startPoint = action.payload;
    },
    clearDimensionDraft: (state) => {
      state.dimensionMode.startPoint = null;
    },
    setMeshingModeActive: (state, action) => {
      state.meshingMode.active = action.payload;
      if (!action.payload) {
        state.meshingMode.tool = "SELECT";
        state.meshingMode.cutSide = "LEFT";
        state.meshingMode.shootActive = false;
      } else {
        // Mutually exclusive with drawing, move and dimension modes.
        state.drawingMode.active = false;
        state.drawingMode.inProgressPolyline = [];
        state.drawingMode.trait3DSegments = [];
        state.drawingMode.axisLock = null;
        state.moveMode.active = false;
        state.moveMode.selectedAnnotationId = null;
        state.moveMode.deltaZ = 0;
        state.dimensionMode.active = false;
        state.dimensionMode.startPoint = null;
        state.walkMode.active = false;
      }
    },
    setMeshingTool: (state, action) => {
      state.meshingMode.tool = action.payload;
      state.meshingMode.cutSide = "LEFT";
    },
    setMeshingOffset: (state, action) => {
      state.meshingMode.offset = action.payload;
    },
    toggleMeshingCutSide: (state) => {
      state.meshingMode.cutSide =
        state.meshingMode.cutSide === "LEFT" ? "RIGHT" : "LEFT";
    },
    setMeshingShootActive: (state, action) => {
      state.meshingMode.shootActive = !!action.payload;
    },
    setWalkModeActive: (state, action) => {
      state.walkMode.active = !!action.payload;
      if (action.payload) {
        // Mutually exclusive with every 3D tool mode.
        state.drawingMode.active = false;
        state.drawingMode.inProgressPolyline = [];
        state.drawingMode.trait3DSegments = [];
        state.drawingMode.axisLock = null;
        state.moveMode.active = false;
        state.moveMode.selectedAnnotationId = null;
        state.moveMode.deltaZ = 0;
        state.dimensionMode.active = false;
        state.dimensionMode.startPoint = null;
        state.meshingMode.active = false;
        state.meshingMode.tool = "SELECT";
        state.meshingMode.shootActive = false;
      }
    },
    setHideAnnotationsIn3d: (state, action) => {
      state.hideAnnotationsIn3d = action.payload;
    },
    setMesh3dLabels: (state, action) => {
      // Partial update: {visible?, showNumber?, showQties?}.
      state.mesh3dLabels = { ...state.mesh3dLabels, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    // Selecting a base map as main must reveal it fully — reset its hide
    // flags. Matched by type string to avoid importing mapEditorSlice.
    builder.addMatcher(
      (action) => action.type === "mapEditors/setSelectedMainBaseMapId",
      (state) => {
        state.hideMainBaseMapImageIn3d = false;
        state.hideMainBaseMapAnnotationsIn3d = false;
      }
    );
  },
});

export const {
  setShowGrid,
  setHideBaseMaps,
  setDisableOpacity,
  setAntiAliasingShrink,
  setRenderMode,
  setEditorMode,
  setDrawingOffset,
  setBaseMapOpacityIn3d,
  setBaseMapOpacityByIdIn3d,
  toggleBaseMapVisibleIn3d,
  setVisibleBaseMapIdsIn3d,
  setHideMainBaseMapImageIn3d,
  setHideMainBaseMapAnnotationsIn3d,
  setBaseMapAnnotationsModeIn3d,
  toggleMainBaseMapImageIn3d,
  toggleMainBaseMapAnnotationsIn3d,
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
  setClippingPlaneEnabled,
  setClippingPlaneEditing,
  toggleClippingPlaneEditing,
  setDimensionModeActive,
  setDimensionStartPoint,
  clearDimensionDraft,
  setMeshingModeActive,
  setMeshingTool,
  setMeshingOffset,
  toggleMeshingCutSide,
  setMeshingShootActive,
  setWalkModeActive,
  setHideAnnotationsIn3d,
  setMesh3dLabels,
} = threedEditorSlice.actions;

export default threedEditorSlice.reducer;
