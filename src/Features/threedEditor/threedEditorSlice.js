import { createSlice } from "@reduxjs/toolkit";

const threedEditorInitialState = {
  showGrid: false,
  // When true, basemap images are hidden in the live 3D view AND omitted from
  // the 3D scene export (USDZ / OBJ) — annotation objects are unaffected.
  hideBaseMaps: false,
  // When true, annotation materials ignore `annotation.opacity` and render
  // fully opaque. Exposed as the "Transparence des annotations" switch.
  disableOpacity: false,
  // Bumped after each loadAnnotations pass (basemap groups guaranteed to
  // exist at that point). Consumed by the effects that attach objects to the
  // basemap groups (ThreedAnnotationLabels, ThreedCoteAnnotations): on a
  // fresh page load landing directly on 3D, their first run happens BEFORE
  // the parent loader hooks create the groups, and nothing else re-runs them.
  annotationsLoadTick: 0,
  // When true, CM-width POLYLINE footprints are contracted by 10 mm before
  // extrusion to avoid coplanar-face aliasing when a parement abuts a wall.
  antiAliasingShrink: true,
  // Max dihedral angle (degrees) joining two adjacent facets into the same
  // "face" when hovering / picking a surface in 3D (see faceHoverHighlight).
  // 0 = strictly coplanar facets only; 25 follows a revolution or swept
  // surface across its facets without crossing a real crease.
  faceSelectionAngleDeg: 25,
  // "Wireframe" section: black grid-edge lines drawn on annotation meshes
  // (EdgesGeometry overlays). showWireframe toggles them; wireframeAngleDeg is
  // the EdgesGeometry dihedral threshold (degrees) — 1 (three's default) draws
  // every lathe/sweep facet seam, higher values keep only silhouettes and
  // real creases. Synced live by MainThreedEditor →
  // AnnotationsManager.setWireframeSettings.
  showWireframe: true,
  wireframeAngleDeg: 1,
  // Viewport render mode (session-only). "STANDARD" = the historical unlit /
  // Lambert look. "REALISTIC" = real-time PBR: physical materials, white
  // environment lighting, ACES tone mapping. "PHOTOREAL" = the full raster
  // archviz state (default): HDR-driven lighting (IBL, no sky background),
  // warm sun with cast shadows and textured PBR materials (material3d
  // presets). Clipping-compatible.
  renderMode: "PHOTOREAL",
  // PHOTOREAL environment (session-only). "STANDARD" = neutral studio (no
  // sky), "EXTERIOR" = HDR sky + warm sun, "INTERIOR" = indoor HDR (e.g. a
  // parking level — a sky background would be wrong there).
  environment3d: "EXTERIOR",
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
  // Viewer landing window: while true, selecting a main baseMap does NOT
  // reset the hideMain* flags (see extraReducers) — the startup restore of
  // the persisted main would flash the image mid-load otherwise.
  revealOnMainSelectSuspended: false,
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
  // Single clipping plane (session-only). `enabled` = plane applied to the
  // annotation/basemap materials; `editing` = panel + draggable gizmo shown.
  // The plane geometry itself lives in ClippingManager (three.js side).
  clippingPlane: {
    enabled: false,
    editing: false,
  },
  // Camera side vs each VERTICAL base map plane, keyed by baseMapId.
  // 1 = camera on the +normal (image-facing) side, -1 = behind. Maintained by
  // useRevolutionSectionIn3d; consumed by the REVOLUTION half-view
  // (revolutions render only the 180° half on the side opposite the camera so
  // the image reads as a section plane).
  // Session-only, display-only — quantities stay full-rotation.
  revolutionSectionSideByBaseMapId: {},
  // "Révolution partielle" switch (3D view settings): ON = 180° half-view of
  // revolutions (camera-side driven); OFF = full 360° revolutions. Explicit
  // per-axis sectors (`revolutionPhi`) apply either way.
  // Display-only, session-only. ON by default.
  forceRevolutionSectionIn3d: true,
  // "Pochage des coupes" switch (3D view settings): fill the section of
  // partial revolutions with a flat dark face when the profile is a closed
  // contour. The ink boundary lines are always shown on partial revolutions;
  // only the fill is optional. Display-only, session-only.
  revolutionSectionFillIn3d: false,
  // Dimension ("cote") mode: click two mesh-snapped points to create a COTE
  // annotation (template-driven via useTemplateCoteDrawBridge, committed by
  // commitDrawnCoteService). Mutually exclusive with `drawingMode.active`.
  dimensionMode: {
    active: false,
    // First clicked endpoint, world space, while the second is pending.
    startPoint: null, // {x, y, z} | null
  },
  // Meshing ("maillage") mode: create mailles from hovered faces and cut
  // them with vertical / horizontal / free lines. Mutually exclusive with
  // `drawingMode.active` and `dimensionMode.active`.
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
  // "Liste" tab of the Maillage drawer: group the mailles list by orientation
  // (Mailles horizontales / Mailles verticales). Session-only.
  mesh3dGroupByOrientation: false,
  // Orientations ("HORIZONTAL" | "VERTICAL") whose mailles are hidden in the
  // 3D scene (group-header eye of the Liste tab). Applies to the scene even
  // when the grouped display is off. Session-only.
  mesh3dHiddenOrientations: [],
  meshingMode: {
    active: false,
    // "SELECT" | "CUT_VERTICAL" | "CUT_HORIZONTAL" | "CUT_FREE"
    // | "CUT_POLYLINE" | "CUT_ANGULAR" | "NUMBER"
    tool: "SELECT",
    // "Décalage": distance (m) from the reference vertex to the guide vertex
    // used by the vertical / horizontal cut tools.
    offset: 2,
    // Side of the maille the reference vertex is picked on. Default LEFT
    // (resp. BOTTOM for horizontal cuts), flipped with the "S" key.
    cutSide: "LEFT", // "LEFT" | "RIGHT"
    // "Multi-mailles": the cut runs through every touching maille the plane
    // (or the angular wedge) crosses, not only the hovered one — a horizontal
    // trait across two vertical bands then yields four mailles. Opt-in: an
    // infinite plane would otherwise reach mailles the user cannot even see.
    multiCut: false,
    // "Numéroter": next number assigned to the clicked maille (then +1).
    numberingNext: 1,
    // Angular cut: digits typed on the keyboard to constrain the angle (deg),
    // exactly like extrudeMode.valueBuffer — no focused field, the pointer
    // handlers capture the keystrokes. A parsable buffer wins over the mouse,
    // which then only picks the side the angle opens to.
    angleBuffer: "",
  },
  // Extrusion ("push/pull") mode, SketchUp-style: click a top face, move the
  // mouse to set the value, click again to commit `annotation.height`.
  // Mutually exclusive with the other 3D tool modes.
  extrudeMode: {
    active: false,
    // Live extrusion value in meters — typed in the toolbar field OR derived
    // from the mouse while a face is armed. Kept across commits so the next
    // face reuses the last value (SketchUp behaviour).
    value: 0.1,
    // Digits typed on the keyboard, exactly like the 2D drawing constraint
    // buffer (mapEditor.constraintBuffer): no focused field involved, the
    // pointer handlers capture the keystrokes. A non-empty buffer wins over
    // the mouse-derived `value`. Cleared on commit / mode (re)activation.
    valueBuffer: "",
    // Annotation armed by the first click (null = waiting for a face).
    targetAnnotationId: null,
  },
  // "Déplacer" mode: grab a snapped point (vertex / feature edge) of a base
  // map's content (image corner, annotation vertex), the whole base map
  // group (image + annotations) then follows the mouse; the drop click
  // recomputes the base map `position` so the grabbed point lands exactly
  // on the drop point (translation only — rotation is kept). Mutually
  // exclusive with the other 3D tool modes.
  moveBaseMapMode: {
    active: false,
    // Base map currently carried (null = waiting for the grab click).
    carriedBaseMapId: null,
  },
  // "Tourner" mode: 1st snapped click sets the rotation pivot (and picks the
  // base map), the mouse then rotates the whole base map group (image +
  // annotations) around the WORLD-VERTICAL axis through the pivot — whatever
  // the plane orientation (the group euler is YXZ, so adding to rotation.y
  // IS a world-Y rotation) — and the 2nd click commits `angleDeg` + the
  // recomputed `position`. Mutually exclusive with the other 3D tool modes.
  rotateBaseMapMode: {
    active: false,
    // Base map currently rotating (null = waiting for the pivot click).
    carriedBaseMapId: null,
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
    setFaceSelectionAngleDeg: (state, action) => {
      state.faceSelectionAngleDeg = action.payload;
    },
    setShowWireframe: (state, action) => {
      state.showWireframe = action.payload;
    },
    setWireframeAngleDeg: (state, action) => {
      state.wireframeAngleDeg = action.payload;
    },
    setRenderMode: (state, action) => {
      state.renderMode = action.payload;
    },
    setEnvironment3d: (state, action) => {
      state.environment3d = action.payload;
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
    // Bulk replacement — scope-open seeding of the Viewer module (every
    // annotated baseMap gets its annotations displayed at once).
    setAnnotationsModeByBaseMapIdIn3d: (state, action) => {
      state.annotationsModeByBaseMapIdIn3d = action.payload ?? {};
    },
    // Viewer landing window: suspends the "reveal fully" reset of the
    // hideMain* flags on setSelectedMainBaseMapId (see extraReducers) — the
    // persisted-main restore fires it at an arbitrary point of the startup
    // and would flash the image mid-load. Driven by
    // useInitViewerModuleOnScopeOpen.
    setRevealOnMainSelectSuspended: (state, action) => {
      state.revealOnMainSelectSuspended = Boolean(action.payload);
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
        // Mutually exclusive with dimension mode.
        state.dimensionMode.active = false;
        state.dimensionMode.startPoint = null;
        state.meshingMode.active = false;
        state.meshingMode.tool = "SELECT";
        state.walkMode.active = false;
        state.extrudeMode.active = false;
        state.extrudeMode.targetAnnotationId = null;
        state.moveBaseMapMode.active = false;
        state.moveBaseMapMode.carriedBaseMapId = null;
        state.rotateBaseMapMode.active = false;
        state.rotateBaseMapMode.carriedBaseMapId = null;
      }
    },
    bumpSnapIndexEpoch: (state) => {
      state.drawingMode.snapIndexEpoch += 1;
    },
    bumpAnnotationsLoadTick: (state) => {
      state.annotationsLoadTick += 1;
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
    // Dispatched only when the camera crosses a vertical base map plane
    // (rare) — the value feeds the annotations build epoch, so each change
    // rebuilds the 3D objects.
    setRevolutionSectionSide: (state, action) => {
      const { baseMapId, side } = action.payload || {};
      if (!baseMapId) return;
      if (side !== 1 && side !== -1) {
        delete state.revolutionSectionSideByBaseMapId[baseMapId];
      } else {
        state.revolutionSectionSideByBaseMapId[baseMapId] = side;
      }
    },
    setForceRevolutionSectionIn3d: (state, action) => {
      state.forceRevolutionSectionIn3d = Boolean(action.payload);
    },
    setRevolutionSectionFillIn3d: (state, action) => {
      state.revolutionSectionFillIn3d = Boolean(action.payload);
    },
    setClippingPlaneEnabled: (state, action) => {
      state.clippingPlane.enabled = action.payload;
      if (!action.payload) state.clippingPlane.editing = false;
    },
    setClippingPlaneEditing: (state, action) => {
      state.clippingPlane.editing = action.payload;
      // Opening the editor implicitly creates/enables the plane.
      if (action.payload) state.clippingPlane.enabled = true;
    },
    toggleClippingPlaneEditing: (state) => {
      const next = !state.clippingPlane.editing;
      state.clippingPlane.editing = next;
      if (next) state.clippingPlane.enabled = true;
    },
    setDimensionModeActive: (state, action) => {
      state.dimensionMode.active = action.payload;
      if (!action.payload) {
        state.dimensionMode.startPoint = null;
      } else {
        // Mutually exclusive with drawing and meshing modes.
        state.drawingMode.active = false;
        state.drawingMode.inProgressPolyline = [];
        state.drawingMode.trait3DSegments = [];
        state.drawingMode.axisLock = null;
        state.meshingMode.active = false;
        state.meshingMode.tool = "SELECT";
        state.walkMode.active = false;
        state.extrudeMode.active = false;
        state.extrudeMode.targetAnnotationId = null;
        state.moveBaseMapMode.active = false;
        state.moveBaseMapMode.carriedBaseMapId = null;
        state.rotateBaseMapMode.active = false;
        state.rotateBaseMapMode.carriedBaseMapId = null;
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
      } else {
        // Mutually exclusive with drawing and dimension modes.
        state.drawingMode.active = false;
        state.drawingMode.inProgressPolyline = [];
        state.drawingMode.trait3DSegments = [];
        state.drawingMode.axisLock = null;
        state.dimensionMode.active = false;
        state.dimensionMode.startPoint = null;
        state.walkMode.active = false;
        state.extrudeMode.active = false;
        state.extrudeMode.targetAnnotationId = null;
        state.moveBaseMapMode.active = false;
        state.moveBaseMapMode.carriedBaseMapId = null;
        state.rotateBaseMapMode.active = false;
        state.rotateBaseMapMode.carriedBaseMapId = null;
      }
    },
    setMeshingTool: (state, action) => {
      state.meshingMode.tool = action.payload;
      state.meshingMode.cutSide = "LEFT";
      state.meshingMode.angleBuffer = "";
    },
    setMeshingOffset: (state, action) => {
      state.meshingMode.offset = action.payload;
    },
    setMeshingNumberingNext: (state, action) => {
      state.meshingMode.numberingNext = action.payload;
    },
    setMeshingMultiCut: (state, action) => {
      state.meshingMode.multiCut = !!action.payload;
    },
    toggleMeshingCutSide: (state) => {
      state.meshingMode.cutSide =
        state.meshingMode.cutSide === "LEFT" ? "RIGHT" : "LEFT";
    },
    // Typed angle buffer of the angular cut (mirrors the extrude buffer).
    appendToMeshingAngleBuffer: (state, action) => {
      state.meshingMode.angleBuffer += action.payload;
    },
    deleteLastMeshingAngleBuffer: (state) => {
      state.meshingMode.angleBuffer = state.meshingMode.angleBuffer.slice(
        0,
        -1
      );
    },
    clearMeshingAngleBuffer: (state) => {
      state.meshingMode.angleBuffer = "";
    },
    setExtrudeModeActive: (state, action) => {
      state.extrudeMode.active = action.payload;
      state.extrudeMode.targetAnnotationId = null;
      state.extrudeMode.valueBuffer = "";
      if (action.payload) {
        // Mutually exclusive with every other 3D tool mode.
        state.drawingMode.active = false;
        state.drawingMode.inProgressPolyline = [];
        state.drawingMode.trait3DSegments = [];
        state.drawingMode.axisLock = null;
        state.dimensionMode.active = false;
        state.dimensionMode.startPoint = null;
        state.meshingMode.active = false;
        state.meshingMode.tool = "SELECT";
        state.walkMode.active = false;
        state.moveBaseMapMode.active = false;
        state.moveBaseMapMode.carriedBaseMapId = null;
        state.rotateBaseMapMode.active = false;
        state.rotateBaseMapMode.carriedBaseMapId = null;
      }
    },
    // Mouse-driven update. A no-op while the typed buffer is non-empty — the
    // pointer handlers skip tracking there.
    setExtrudeValue: (state, action) => {
      state.extrudeMode.value = action.payload;
    },
    // Typed buffer (mirrors mapEditor's constraintBuffer reducers).
    setExtrudeValueBuffer: (state, action) => {
      state.extrudeMode.valueBuffer = action.payload ?? "";
    },
    appendToExtrudeValueBuffer: (state, action) => {
      state.extrudeMode.valueBuffer += action.payload;
    },
    deleteLastExtrudeValueBuffer: (state) => {
      state.extrudeMode.valueBuffer = state.extrudeMode.valueBuffer.slice(
        0,
        -1
      );
    },
    clearExtrudeValueBuffer: (state) => {
      state.extrudeMode.valueBuffer = "";
    },
    setExtrudeTargetAnnotationId: (state, action) => {
      state.extrudeMode.targetAnnotationId = action.payload;
    },
    setWalkModeActive: (state, action) => {
      state.walkMode.active = !!action.payload;
      if (action.payload) {
        // Mutually exclusive with every 3D tool mode.
        state.drawingMode.active = false;
        state.drawingMode.inProgressPolyline = [];
        state.drawingMode.trait3DSegments = [];
        state.drawingMode.axisLock = null;
        state.dimensionMode.active = false;
        state.dimensionMode.startPoint = null;
        state.meshingMode.active = false;
        state.meshingMode.tool = "SELECT";
        state.extrudeMode.active = false;
        state.extrudeMode.targetAnnotationId = null;
        state.moveBaseMapMode.active = false;
        state.moveBaseMapMode.carriedBaseMapId = null;
        state.rotateBaseMapMode.active = false;
        state.rotateBaseMapMode.carriedBaseMapId = null;
      }
    },
    setMoveBaseMapModeActive: (state, action) => {
      state.moveBaseMapMode.active = !!action.payload;
      state.moveBaseMapMode.carriedBaseMapId = null;
      if (action.payload) {
        // Mutually exclusive with every other 3D tool mode.
        state.drawingMode.active = false;
        state.drawingMode.inProgressPolyline = [];
        state.drawingMode.trait3DSegments = [];
        state.drawingMode.axisLock = null;
        state.dimensionMode.active = false;
        state.dimensionMode.startPoint = null;
        state.meshingMode.active = false;
        state.meshingMode.tool = "SELECT";
        state.walkMode.active = false;
        state.extrudeMode.active = false;
        state.extrudeMode.targetAnnotationId = null;
        state.rotateBaseMapMode.active = false;
        state.rotateBaseMapMode.carriedBaseMapId = null;
      }
    },
    setMoveBaseMapCarriedId: (state, action) => {
      state.moveBaseMapMode.carriedBaseMapId = action.payload ?? null;
    },
    setRotateBaseMapModeActive: (state, action) => {
      state.rotateBaseMapMode.active = !!action.payload;
      state.rotateBaseMapMode.carriedBaseMapId = null;
      if (action.payload) {
        // Mutually exclusive with every other 3D tool mode.
        state.drawingMode.active = false;
        state.drawingMode.inProgressPolyline = [];
        state.drawingMode.trait3DSegments = [];
        state.drawingMode.axisLock = null;
        state.dimensionMode.active = false;
        state.dimensionMode.startPoint = null;
        state.meshingMode.active = false;
        state.meshingMode.tool = "SELECT";
        state.walkMode.active = false;
        state.extrudeMode.active = false;
        state.extrudeMode.targetAnnotationId = null;
        state.moveBaseMapMode.active = false;
        state.moveBaseMapMode.carriedBaseMapId = null;
      }
    },
    setRotateBaseMapCarriedId: (state, action) => {
      state.rotateBaseMapMode.carriedBaseMapId = action.payload ?? null;
    },
    setHideAnnotationsIn3d: (state, action) => {
      state.hideAnnotationsIn3d = action.payload;
    },
    setMesh3dLabels: (state, action) => {
      // Partial update: {visible?, showNumber?, showQties?}.
      state.mesh3dLabels = { ...state.mesh3dLabels, ...action.payload };
    },
    setMesh3dGroupByOrientation: (state, action) => {
      state.mesh3dGroupByOrientation = Boolean(action.payload);
    },
    toggleMesh3dHiddenOrientation: (state, action) => {
      const i = state.mesh3dHiddenOrientations.indexOf(action.payload);
      if (i === -1) state.mesh3dHiddenOrientations.push(action.payload);
      else state.mesh3dHiddenOrientations.splice(i, 1);
    },
  },
  extraReducers: (builder) => {
    // Selecting a base map as main must reveal it fully — reset its hide
    // flags. Matched by type string to avoid importing mapEditorSlice.
    // Suspended during the Viewer landing window (revealOnMainSelectSuspended)
    // so the startup restore of the persisted main doesn't flash the image.
    builder.addMatcher(
      (action) => action.type === "mapEditors/setSelectedMainBaseMapId",
      (state) => {
        if (state.revealOnMainSelectSuspended) return;
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
  setFaceSelectionAngleDeg,
  setShowWireframe,
  setWireframeAngleDeg,
  setRenderMode,
  setEnvironment3d,
  setEditorMode,
  setDrawingOffset,
  setBaseMapOpacityIn3d,
  setBaseMapOpacityByIdIn3d,
  toggleBaseMapVisibleIn3d,
  setVisibleBaseMapIdsIn3d,
  setHideMainBaseMapImageIn3d,
  setHideMainBaseMapAnnotationsIn3d,
  setBaseMapAnnotationsModeIn3d,
  setAnnotationsModeByBaseMapIdIn3d,
  setRevealOnMainSelectSuspended,
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
  bumpAnnotationsLoadTick,
  setSubSelection,
  clearSubSelection,
  setRevolutionSectionSide,
  setForceRevolutionSectionIn3d,
  setRevolutionSectionFillIn3d,
  setClippingPlaneEnabled,
  setClippingPlaneEditing,
  toggleClippingPlaneEditing,
  setDimensionModeActive,
  setDimensionStartPoint,
  clearDimensionDraft,
  setMeshingModeActive,
  setMeshingTool,
  setMeshingOffset,
  setMeshingNumberingNext,
  toggleMeshingCutSide,
  setMeshingMultiCut,
  appendToMeshingAngleBuffer,
  deleteLastMeshingAngleBuffer,
  clearMeshingAngleBuffer,
  setExtrudeModeActive,
  setExtrudeValue,
  setExtrudeValueBuffer,
  appendToExtrudeValueBuffer,
  deleteLastExtrudeValueBuffer,
  clearExtrudeValueBuffer,
  setExtrudeTargetAnnotationId,
  setWalkModeActive,
  setMoveBaseMapModeActive,
  setMoveBaseMapCarriedId,
  setRotateBaseMapModeActive,
  setRotateBaseMapCarriedId,
  setHideAnnotationsIn3d,
  setMesh3dLabels,
  setMesh3dGroupByOrientation,
  toggleMesh3dHiddenOrientation,
} = threedEditorSlice.actions;

export default threedEditorSlice.reducer;
