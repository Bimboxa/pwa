import React, { useRef, useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { Box3, Raycaster, Vector2, Vector3 } from "three";

import useAutoLoadMapsInThreedEditor from "../hooks/useAutoLoadMapsInThreedEditor";
import useAutoLoadAnnotationsInThreedEditor from "../hooks/useAutoLoadAnnotationsInThreedEditor";
import useDeleteAnnotationOnKeyboardInThreedEditor from "../hooks/useDeleteAnnotationOnKeyboardInThreedEditor";
import useApplyBaseMapOpacityIn3d from "../hooks/useApplyBaseMapOpacityIn3d";
import useApplyBaseMapVisibilityIn3d from "../hooks/useApplyBaseMapVisibilityIn3d";
import useApplyBaseMapTransformsIn3d from "../hooks/useApplyBaseMapTransformsIn3d";
import useSyncClippingPlanTo3D from "../hooks/useSyncClippingPlanTo3D";
import useNavigateCameraOnEvent from "../hooks/useNavigateCameraOnEvent";
import useSelectAnnotationOnEvent from "../hooks/useSelectAnnotationOnEvent";
import {
  setSelectedNode,
  setAnnotationToolbarPosition,
  setAnnotationsToolbarPosition,
  setSelectedMainBaseMapId,
} from "Features/mapEditor/mapEditorSlice";
import {
  setSelectedItem,
  setSelectedItems,
  toggleItemSelection,
  setShowAnnotationsProperties,
} from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

import applyAnnotationMaterialState, {
  // states
  STATE_DIM,
  STATE_HOVER,
  STATE_NONE,
  setHighlightClippingPlanes,
} from "Features/threedEditor/js/utilsAnnotationsManager/applyAnnotationMaterialState";
import {
  buildEdgeHelper,
  buildVertexHelper,
  disposeSubSelectionHelper,
  findClosestEdgeToCursor,
  findClosestVertexToCursor,
} from "Features/threedEditor/js/utilsAnnotationsManager/subSelectionHelpers";
import {
  filterIntersectionsByClipping,
  getActiveClippingPlane,
  isWorldPointVisible,
} from "Features/threedEditor/js/utilsAnnotationsManager/clippingPick";
import {
  buildFaceHoverOverlay,
  disposeFaceHoverOverlay,
  getCoplanarRegion,
  setFaceHoverClippingPlanes,
} from "Features/threedEditor/js/utilsAnnotationsManager/faceHoverHighlight";
import ThreedHoverTooltip from "./ThreedHoverTooltip";
import ThreedLassoOverlay from "./ThreedLassoOverlay";
import ThreedPopperEditAnnotations from "./ThreedPopperEditAnnotations";
import ThreedImageModeOverlay from "./ThreedImageModeOverlay";
import ThreedSelectionDimmer from "./ThreedSelectionDimmer";

import { Box } from "@mui/material";

import ThreedEditor from "Features/threedEditor/js/ThreedEditor";
import {
  setActiveThreedEditor,
  clearActiveThreedEditor,
} from "Features/threedEditor/services/threedEditorRegistry";
import PopperEditAnnotation from "Features/mapEditor/components/PopperEditAnnotation";
import PopperMapListings from "Features/mapEditor/components/PopperMapListings";
import ClippingToolbarThreed from "./ClippingToolbarThreed";
import BottomToolbarThreed from "Features/threedDrawing/components/BottomToolbarThreed";
import DrawingOverlayThreed from "Features/threedDrawing/components/DrawingOverlayThreed";
import MoveGizmoThreed from "Features/threedDrawing/components/MoveGizmoThreed";
import useDrawingPointerHandlers from "Features/threedDrawing/hooks/useDrawingPointerHandlers";
import {
  clearSubSelection,
  setSubSelection,
} from "Features/threedEditor/threedEditorSlice";
import DimensionDraftOverlayThreed from "Features/threedDimensions/components/DimensionDraftOverlayThreed";
import ThreedDimensions from "Features/threedDimensions/components/ThreedDimensions";
import PopperEditDimension from "Features/threedDimensions/components/PopperEditDimension";
import useDimensionPointerHandlers from "Features/threedDimensions/hooks/useDimensionPointerHandlers";
import { getDimensionObjects } from "Features/threedDimensions/services/dimensionObjectsStore";
import MeshingToolbarThreed from "Features/threedMesh/components/MeshingToolbarThreed";
import MeshingOverlayThreed from "Features/threedMesh/components/MeshingOverlayThreed";
import ThreedMeshes from "Features/threedMesh/components/ThreedMeshes";
import PopperEditMesh3d from "Features/threedMesh/components/PopperEditMesh3d";
import PopperEditMeshes3d from "Features/threedMesh/components/PopperEditMeshes3d";
import useMeshingPointerHandlers from "Features/threedMesh/hooks/useMeshingPointerHandlers";
import {
  getMesh3dSprites,
  getMesh3dFaceMeshes,
} from "Features/threedMesh/services/mesh3dObjectsStore";
import { filterIntersectionsByVisibility } from "Features/threedEditor/js/utilsAnnotationsManager/visibilityPick";
import ThreedAnnotationsVisibility from "./ThreedAnnotationsVisibility";
import TopBaseMapChipsThreed from "./TopBaseMapChipsThreed";

export default function MainThreedEditor() {
  // ref

  const containerRef = useRef();
  const threedEditorRef = useRef();
  const raycasterRef = useRef(new Raycaster());
  const mouseRef = useRef(new Vector2());
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hoverRafRef = useRef(null);
  const lastPointerEventRef = useRef(null);
  const prevHoveredObjectRef = useRef(null);
  const lastHoveredIdRef = useRef(null);
  const tooltipApiRef = useRef(null);
  // Lasso (shift+drag) state
  const lassoStartRef = useRef(null); // { x, y } in client coords, or null
  const lassoRectRef = useRef(null); // current rect (client coords)
  const lassoOverlayRef = useRef(null); // imperative API of <ThreedLassoOverlay />
  const orbitWasEnabledRef = useRef(true); // remember orbit state to restore
  const lassoLiveIdsRef = useRef(new Set()); // ids currently shown as green during the drag
  const lassoPreviewRafRef = useRef(null); // rAF handle for the preview pass
  // Sub-selection helpers (vertex/edge highlight on the selected annotation):
  // ephemeral hover helper (replaced as the cursor moves) and persistent
  // selected helper (replaced when the user clicks a different vertex/edge).
  const subHoverHelperRef = useRef(null);
  const subSelectedHelperRef = useRef(null);
  const subHoverKeyRef = useRef(null); // "V:<idx>" or "E:<a>-<b>" or null
  // Face hover overlay (blue-dot stipple on the hovered coplanar face):
  // transient Mesh added as a child of the hit mesh, keyed on
  // `${mesh.uuid}:${regionId}` so moving within the same face never rebuilds.
  const faceHoverOverlayRef = useRef(null);
  const faceHoverKeyRef = useRef(null);

  // state

  const [containerElExists, setContainerElExists] = useState(false);
  const [rendererIsReady, setRendererIsReady] = useState(false); // to trigger the effect load shapes with an existing loadShapes func.

  const dispatch = useDispatch();
  // Read the store directly (no re-render on state changes) so we can resolve
  // the current selection inside event handlers without making MainThreedEditor
  // re-render on every selection change — re-renders here would re-fire
  // useAutoLoadAnnotationsInThreedEditor and destroy + recreate every
  // annotation 3D object.
  const store = useStore();
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const isThreedViewer = isThreedFamilyViewerKey(selectedViewerKey);

  // Entering the 3D viewer keeps whatever right panel was open in 2D (no
  // auto-open of THREED_PROPERTIES). Leaving the 3D viewer closes the
  // THREED_PROPERTIES panel if it is the active one, since its menu item only
  // exists while the 3D viewer is active. The current panel key is read from
  // the store directly to avoid re-rendering MainThreedEditor on every
  // right-panel change (which would recreate the 3D annotation objects).
  const prevIsThreedRef = useRef(false);
  useEffect(() => {
    if (!isThreedViewer && prevIsThreedRef.current) {
      if (
        store.getState().rightPanel.selectedMenuItemKey === "THREED_PROPERTIES"
      ) {
        dispatch(setSelectedMenuItemKey(null));
      }
    }
    prevIsThreedRef.current = isThreedViewer;
  }, [isThreedViewer, dispatch, store]);

  const showGrid = useSelector((s) => s.threedEditor.showGrid);
  // Capture mode ("Export rapide", shared with the 2D viewer). Toggles are
  // rare, so the re-render cost is acceptable here.
  const imageModeEnabled = useSelector((s) => s.mapEditor.imageModeEnabled);
  // Render mode (Standard / Réaliste / Photoréaliste). Mirrored into a ref so
  // the hover raycast can read it without re-creating its callback.
  const renderMode = useSelector((s) => s.threedEditor.renderMode);
  const renderModeRef = useRef(renderMode);
  useEffect(() => {
    renderModeRef.current = renderMode;
  }, [renderMode]);
  const clippingEnabled = useSelector(
    (s) => s.threedEditor.clippingPlane.enabled
  );
  const clippingEditing = useSelector(
    (s) => s.threedEditor.clippingPlane.editing
  );
  // Mirror editorMode into a ref so pointer handlers can read the current
  // value without depending on state — re-creating the handlers would
  // invalidate the registered listeners and break drag tracking mid-stream.
  const editorMode = useSelector((s) => s.threedEditor.editorMode);
  const editorModeRef = useRef(editorMode);
  useEffect(() => {
    editorModeRef.current = editorMode;
  }, [editorMode]);

  // Mirror drawingMode.active into a ref so the existing pointer handlers can
  // short-circuit without re-creating their callbacks (which would reset the
  // drag tracking mid-stream).
  const drawingActive = useSelector((s) => s.threedEditor.drawingMode.active);
  const drawingActiveRef = useRef(drawingActive);
  useEffect(() => {
    drawingActiveRef.current = drawingActive;
  }, [drawingActive]);

  // Same pattern for move mode.
  const moveActive = useSelector((s) => s.threedEditor.moveMode.active);
  const moveActiveRef = useRef(moveActive);
  useEffect(() => {
    moveActiveRef.current = moveActive;
  }, [moveActive]);

  // Same pattern for the dimension ("cote") tool — useDimensionPointerHandlers
  // owns the pointer while active, so the selection click path short-circuits.
  const dimensionActive = useSelector(
    (s) => s.threedEditor.dimensionMode.active
  );
  const dimensionActiveRef = useRef(dimensionActive);
  useEffect(() => {
    dimensionActiveRef.current = dimensionActive;
  }, [dimensionActive]);

  // Same pattern for meshing mode — useMeshingPointerHandlers owns the
  // pointer (hover stipple, maille creation, cut tools) while active.
  const meshingActive = useSelector((s) => s.threedEditor.meshingMode.active);
  const meshingActiveRef = useRef(meshingActive);
  useEffect(() => {
    meshingActiveRef.current = meshingActive;
  }, [meshingActive]);

  // Sub-selection (vertex / edge inside the selected annotation). Sourced
  // from threedEditorSlice. We subscribe via useSelector with a primitive
  // key so React only re-renders when the meaningful identity changes.
  const subSelectionKey = useSelector((s) => {
    const sub = s.threedEditor.subSelection;
    if (!sub?.annotationId || !sub?.kind) return null;
    if (sub.kind === "VERTEX")
      return `${sub.annotationId}|V|${sub.vertexIndex}`;
    return `${sub.annotationId}|E|${sub.vertexIndex}-${sub.vertexIndexB}`;
  });

  useDrawingPointerHandlers();
  useDimensionPointerHandlers();
  useMeshingPointerHandlers();

  // Drive the 3D clipping plane from the 2D-defined segment (top view).
  useSyncClippingPlanTo3D({ threedEditorRef, rendererIsReady });

  // Helper: derive the right material state for a given annotation id, based
  // on the current selection in the store and whether the cursor is currently
  // over it. Selection wins over hover — a selected annotation always shows
  // its original material, even while hovered. Hovered mesh annotations show
  // their original material too (un-dimmed when a selection exists): the
  // highlight is the face-level stipple overlay, not a whole-object recolor.
  // Line-only hits (POINT height trait — no faces) keep the green recolor.
  const getStateForId = useCallback(
    (id, isHovered, isLineHover = false) => {
      const items = store.getState().selection.selectedItems || [];
      const ids = items
        .filter((i) => i.type === "NODE" && i.nodeType === "ANNOTATION")
        .map((i) => i.nodeId || i.id);
      // Maille (MESH3D) selections dim annotations too — same "everything
      // translucent except the selection" mechanism.
      const hasSelection =
        ids.length > 0 ||
        items.some((i) => i.type === "NODE" && i.nodeType === "MESH3D");
      if (ids.includes(id)) return STATE_NONE;
      if (isHovered) return isLineHover ? STATE_HOVER : STATE_NONE;
      if (hasSelection) return STATE_DIM;
      return STATE_NONE;
    },
    [store]
  );

  // Helper: when exactly one annotation is selected, return its id (so we can
  // run sub-element raycasts against just that face). Returns null otherwise.
  const getSoloSelectedAnnotationId = useCallback(() => {
    const items = store.getState().selection.selectedItems || [];
    const ids = items
      .filter((i) => i.type === "NODE" && i.nodeType === "ANNOTATION")
      .map((i) => i.nodeId || i.id);
    if (ids.length !== 1) return null;
    return ids[0];
  }, [store]);

  const clearSubHoverHelper = useCallback(() => {
    if (subHoverHelperRef.current) {
      disposeSubSelectionHelper(subHoverHelperRef.current);
      subHoverHelperRef.current = null;
      subHoverKeyRef.current = null;
      threedEditorRef.current?.renderScene?.();
    }
  }, []);

  const clearFaceHoverOverlay = useCallback(() => {
    if (!faceHoverOverlayRef.current && faceHoverKeyRef.current == null) {
      return;
    }
    disposeFaceHoverOverlay(faceHoverOverlayRef.current);
    faceHoverOverlayRef.current = null;
    faceHoverKeyRef.current = null;
    threedEditorRef.current?.renderScene?.();
  }, []);

  // Sync showGrid → sceneManager.grid.visible (and re-render)
  useEffect(() => {
    const editor = threedEditorRef.current;
    if (!editor || !rendererIsReady) return;
    const grid = editor.sceneManager?.grid;
    if (!grid) return;
    grid.visible = showGrid;
    editor.renderScene();
  }, [showGrid, rendererIsReady]);

  // Sync renderMode → RenderModeManager (tone mapping / shadows / environment
  // / path tracing). The annotation materials rebuild independently through
  // useAutoLoadAnnotationsInThreedEditor (realisticShading option).
  useEffect(() => {
    if (!rendererIsReady) return;
    threedEditorRef.current?.sceneManager?.renderModeManager?.setMode(
      renderMode
    );
  }, [renderMode, rendererIsReady]);

  // Sync clipping plane enabled → ClippingManager (create on first enable).
  useEffect(() => {
    const editor = threedEditorRef.current;
    if (!editor || !rendererIsReady) return;
    const clippingManager = editor.sceneManager?.clippingManager;
    if (!clippingManager) return;
    if (clippingEnabled) clippingManager.ensureCreated();
    clippingManager.setEnabled(clippingEnabled);
    // Keep the hover/dim highlight materials clipped in sync with the plane, so
    // highlighting a clipped annotation doesn't render its hidden half.
    setHighlightClippingPlanes(clippingEnabled ? clippingManager.planes : null);
    setFaceHoverClippingPlanes(clippingEnabled ? clippingManager.planes : null);
  }, [clippingEnabled, rendererIsReady]);

  // Sync clipping plane editing → gizmo visibility.
  useEffect(() => {
    const editor = threedEditorRef.current;
    if (!editor || !rendererIsReady) return;
    const clippingManager = editor.sceneManager?.clippingManager;
    if (!clippingManager) return;
    clippingManager.setEditing(clippingEditing);
  }, [clippingEditing, rendererIsReady]);

  // helpers

  // const animate = () => {
  //   threedEditorRef.current?.renderScene();
  //   requestAnimationFrame(animate);
  // };

  // effect - init

  useEffect(() => {
    const width = containerRef.current?.getBoundingClientRect().width;
    const height = containerRef.current?.getBoundingClientRect().height;
    if (width && height) {
      setContainerElExists(true);
    }
  }, []);

  useEffect(() => {
    if (containerElExists) {
      const threedEditor = new ThreedEditor({
        containerEl: containerRef.current,
        onRendererIsReady: () => setRendererIsReady(true),
      });
      threedEditor.init();
      threedEditorRef.current = threedEditor;
      setActiveThreedEditor(threedEditor);

      threedEditor.renderScene();
      //animate();

      return () => {
        threedEditor.dispose?.();
        clearActiveThreedEditor();
      };
    }
  }, [containerElExists]);

  useAutoLoadMapsInThreedEditor({
    threedEditor: threedEditorRef.current,
    rendererIsReady,
  });

  useApplyBaseMapOpacityIn3d();

  useApplyBaseMapVisibilityIn3d();

  useApplyBaseMapTransformsIn3d();

  useNavigateCameraOnEvent({
    threedEditor: threedEditorRef.current,
    rendererIsReady,
  });

  useSelectAnnotationOnEvent();

  const annotations = useAutoLoadAnnotationsInThreedEditor({
    threedEditor: threedEditorRef.current,
    rendererIsReady,
  });

  useDeleteAnnotationOnKeyboardInThreedEditor({ annotations });

  // Click handler for raycasting
  const handleClick = useCallback(
    (event) => {
      if (!threedEditorRef.current || !rendererIsReady || !isThreedViewer)
        return;
      // In BASEMAP_POSITION mode the pointer is reserved for the transform
      // gizmo and the camera — annotation selection is intentionally disabled.
      if (editorModeRef.current === "BASEMAP_POSITION") return;
      // Drawing mode owns the pointer; useDrawingPointerHandlers handles clicks.
      if (drawingActiveRef.current) return;
      // Dimension mode owns the pointer; useDimensionPointerHandlers handles it.
      if (dimensionActiveRef.current) return;
      // Meshing mode owns the pointer; useMeshingPointerHandlers handles it.
      if (meshingActiveRef.current) return;

      const threedEditor = threedEditorRef.current;
      const sceneManager = threedEditor.sceneManager;
      const renderer = sceneManager.renderer;
      const camera = sceneManager.camera;
      const scene = sceneManager.scene;

      if (!renderer || !camera || !scene) return;

      // Active clipping plane (null when off) — every picking path below ignores
      // geometry hidden by the cut.
      const clippingPlane = getActiveClippingPlane(sceneManager);

      // Check if the click target is within the renderer's DOM element
      // This prevents clicks on portals (like PopperEditAnnotation) from triggering the raycaster
      const rendererElement = renderer.domElement;
      const clickTarget = event.target;

      // If the click is not on the renderer element or its children, ignore it
      // This handles cases where the click is on a portal (like MUI Popper)
      if (!rendererElement.contains(clickTarget)) {
        return;
      }

      // Get bounding rect for mouse coordinate calculation
      const rect = rendererElement.getBoundingClientRect();

      // Basic sanity check - if element has zero dimensions, skip
      if (rect.width === 0 || rect.height === 0) {
        return;
      }

      // Dimension ("cote") sprite hit-test — runs before the annotation
      // raycast (which filters `.isMesh` and so never sees the label sprites).
      // A cote sprite carries `userData.coteId`; selecting it makes it a
      // DIMENSION node in selectionSlice so PopperEditDimension shows up.
      const dimensionObjects = getDimensionObjects();
      if (dimensionObjects.length > 0) {
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y =
          -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const coteHits = filterIntersectionsByClipping(
          raycasterRef.current.intersectObjects(dimensionObjects, false),
          clippingPlane
        );
        const coteId = coteHits[0]?.object?.userData?.coteId;
        if (coteId) {
          const position = { x: event.clientX, y: event.clientY };
          dispatch(
            setSelectedItem({
              id: coteId,
              nodeId: coteId,
              type: "NODE",
              nodeType: "DIMENSION",
            })
          );
          dispatch(setSelectedNode(null));
          dispatch(clearSubSelection());
          dispatch(setAnnotationToolbarPosition(position));
          return;
        }
      }

      // Maille label sprite hit-test — same reason as the cote sprites above.
      const mesh3dSprites = getMesh3dSprites();
      if (mesh3dSprites.length > 0) {
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y =
          -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const spriteHits = filterIntersectionsByClipping(
          raycasterRef.current.intersectObjects(mesh3dSprites, false),
          clippingPlane
        );
        const mesh3dId = spriteHits[0]?.object?.userData?.mesh3dId;
        if (mesh3dId) {
          const item = {
            id: mesh3dId,
            nodeId: mesh3dId,
            type: "NODE",
            nodeType: "MESH3D",
          };
          if (event.shiftKey) {
            dispatch(toggleItemSelection(item));
          } else {
            dispatch(setSelectedItem(item));
            dispatch(setSelectedNode(null));
          }
          dispatch(clearSubSelection());
          return;
        }
      }

      // Sub-element click on the currently-selected annotation: vertex/edge
      // sub-selection takes precedence over the regular face click. Skip when
      // moveMode is active (the gizmo owns the cursor).
      const soloId = getSoloSelectedAnnotationId();
      if (soloId && !moveActiveRef.current) {
        const annoObject =
          sceneManager?.annotationsManager?.annotationsObjectsMap?.[soloId];
        if (annoObject?.userData?.vertexRefs?.length) {
          const cursor = { x: event.clientX, y: event.clientY };
          const vertexHit = findClosestVertexToCursor(
            annoObject,
            cursor,
            camera,
            rect,
            12,
            clippingPlane
          );
          const edgeHit = vertexHit
            ? null
            : findClosestEdgeToCursor(
                annoObject,
                cursor,
                camera,
                rect,
                8,
                clippingPlane
              );
          if (vertexHit) {
            const ref = annoObject.userData.vertexRefs[vertexHit.index];
            dispatch(
              setSubSelection({
                annotationId: soloId,
                kind: "VERTEX",
                pointIds: ref?.pointId ? [ref.pointId] : [],
                vertexIndex: vertexHit.index,
              })
            );
            return;
          }
          if (edgeHit) {
            const refA = annoObject.userData.vertexRefs[edgeHit.indexA];
            const refB = annoObject.userData.vertexRefs[edgeHit.indexB];
            dispatch(
              setSubSelection({
                annotationId: soloId,
                kind: "EDGE",
                pointIds: [refA?.pointId, refB?.pointId].filter(Boolean),
                vertexIndex: edgeHit.indexA,
                vertexIndexB: edgeHit.indexB,
              })
            );
            return;
          }
        }
      }

      // Calculate mouse position in normalized device coordinates (-1 to +1)
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Update raycaster with camera and mouse position
      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      // Get all objects in the scene that intersect with the ray.
      // Filter out non-mesh hits (Line / LineSegments). Three.js raycaster
      // detects lines within `params.Line.threshold` (1 unit by default),
      // so the black edge outlines added by extrudeClosedShape /
      // extrudePolylineWall would otherwise trigger selection well before
      // the cursor reaches the actual surface.
      const intersects = filterIntersectionsByVisibility(
        filterIntersectionsByClipping(
          raycasterRef.current
            .intersectObjects(scene.children, true)
            .filter((i) => i.object?.isMesh),
          clippingPlane
        )
      );

      // Find the first annotation object (check userData). Basemap image hits
      // are remembered but only acted on if NO annotation is hit along the
      // whole ray: flat annotations can be exactly coplanar with the basemap
      // plane, making the distance sort unstable between the two.
      let baseMapHitId = null;
      for (const intersect of intersects) {
        let object = intersect.object;

        if (object.userData?.isBasemap) {
          if (!baseMapHitId) {
            // The image mesh only carries `isBasemap` — the owning group
            // (mesh → meshWrap → group) carries the baseMapId.
            let ancestor = object;
            while (ancestor && !ancestor.userData?.baseMapId)
              ancestor = ancestor.parent;
            baseMapHitId = ancestor?.userData?.baseMapId ?? null;
          }
          continue; // no nodeId in a basemap mesh's ancestor chain
        }

        // Traverse up the object hierarchy to find the parent Group with userData
        // This handles cases where child meshes (walls, caps, edges) are clicked
        while (object) {
          // Maille (3D mesh cell) face — selected like a cote, as a MESH3D
          // node. Shift+click toggles for multi-selection (merge, batch color).
          if (object.userData?.mesh3dId) {
            const item = {
              id: object.userData.mesh3dId,
              nodeId: object.userData.mesh3dId,
              type: "NODE",
              nodeType: "MESH3D",
            };
            if (event.shiftKey) {
              dispatch(toggleItemSelection(item));
            } else {
              dispatch(setSelectedItem(item));
              dispatch(setSelectedNode(null));
            }
            dispatch(clearSubSelection());
            return;
          }
          if (object.userData?.nodeId) {
            const {
              nodeId,
              nodeType,
              annotationType,
              listingId,
              annotationTemplateId,
            } = object.userData;
            const item = {
              id: nodeId,
              nodeId,
              type: "NODE",
              nodeType,
              annotationType,
              listingId,
              annotationTemplateId,
            };
            const position = { x: event.clientX, y: event.clientY };

            if (event.shiftKey) {
              // Shift+click: toggle this annotation in the selection. Don't
              // touch setSelectedNode (single-slot legacy state) so existing
              // single-selection consumers stay sane.
              dispatch(toggleItemSelection(item));
            } else {
              dispatch(
                setSelectedNode({
                  id: nodeId,
                  nodeId,
                  nodeType,
                  annotationType,
                  listingId,
                })
              );
              // Replace the selection — PopperEditAnnotation (singular) reads
              // `selection.selectedItems` via useSelectedNodes.
              dispatch(setSelectedItem(item));
              // Mirror the 2D InteractionLayer: the flag drives the properties
              // panel back chain (annotation → annotationTemplate → listing).
              dispatch(setShowAnnotationsProperties(true));
            }
            // Selection of a face clears any prior vertex/edge sub-selection.
            dispatch(clearSubSelection());

            // Anchor both toolbars at the click — the singular renders when
            // exactly one item is selected, the plural when 2+ are selected.
            dispatch(setAnnotationToolbarPosition(position));
            dispatch(setAnnotationsToolbarPosition(position));

            return; // Stop after finding the first annotation
          }
          object = object.parent;
        }
      }

      // No annotation hit. A plain click on a basemap image selects that
      // basemap as the main one (top-bar selector) — shift stays reserved
      // for the annotation multi-selection / lasso.
      if (baseMapHitId && !event.shiftKey) {
        const mainId = store.getState().mapEditor.selectedBaseMapId;
        if (baseMapHitId !== mainId) {
          dispatch(setSelectedMainBaseMapId(baseMapHitId));
        }
      }

      // Shift+click on empty preserves the selection (mirrors the 2D editor
      // behavior); plain click deselects.
      if (!event.shiftKey) {
        dispatch(setSelectedNode(null));
        dispatch(setSelectedItem(null));
        dispatch(clearSubSelection());
        dispatch(setAnnotationToolbarPosition(null));
        dispatch(setAnnotationsToolbarPosition(null));
      }
    },
    [dispatch, rendererIsReady, isThreedViewer, getSoloSelectedAnnotationId, store]
  );

  // Helper to check if an event target is within a MUI Popper or portal
  const isWithinPopper = useCallback((event) => {
    if (!event || !event.target) return false;

    // Use composedPath to get all elements in the event path (including portals)
    const path = event.composedPath ? event.composedPath() : [];

    // Check all elements in the path
    for (const element of path) {
      if (!element || typeof element.classList === "undefined") continue;

      // Check for MUI Popper classes
      const classList = element.classList;
      if (classList) {
        for (const className of classList) {
          if (
            className.includes("MuiPopper") ||
            className.includes("MuiPaper") ||
            className.includes("MuiBox")
          ) {
            // Additional check: make sure it's actually a popper, not just any MUI component
            if (
              className.includes("MuiPopper") ||
              element.closest?.(".MuiPopper-root")
            ) {
              return true;
            }
          }
        }
      }
    }

    // Fallback: check the target and its parents
    let current = event.target;
    while (current && current !== document.body) {
      const classList = current.classList;
      if (classList) {
        for (const className of classList) {
          if (className.includes("MuiPopper")) {
            return true;
          }
        }
      }
      if (current.closest && current.closest(".MuiPopper-root")) {
        return true;
      }
      current = current.parentElement;
    }

    return false;
  }, []);

  // Lasso helpers ---------------------------------------------------------

  // Compute the screen-space (client) center of an annotation 3D object.
  // Returns null if the object has no renderable geometry (e.g. an OBJECT_3D
  // placeholder whose GLB hasn't loaded yet).
  const projectAnnotationToClient = useCallback(
    (object3D, camera, canvasRect, plane = null) => {
      const box = new Box3();
      box.makeEmpty();
      box.setFromObject(object3D);
      if (box.isEmpty() || !isFinite(box.min.x)) return null;
      const center = new Vector3();
      box.getCenter(center);
      // Center-based heuristic: drop the annotation when its bbox center is
      // hidden by the clipping plane (consistent with the existing center-point
      // lasso model; an annotation whose center is clipped but whose edges peek
      // through is excluded).
      if (plane && !isWorldPointVisible(plane, center)) return null;
      center.project(camera); // → NDC space [-1, 1]
      const sx = canvasRect.left + (center.x * 0.5 + 0.5) * canvasRect.width;
      const sy = canvasRect.top + (-center.y * 0.5 + 0.5) * canvasRect.height;
      return { x: sx, y: sy };
    },
    []
  );

  // Imperatively diff the set of annotations whose center is inside the
  // current lasso rect against the previously-shown set, and toggle their
  // material between HOVER (inside) and their normal non-hover state
  // (outside). No React state is touched — re-rendering MainThreedEditor on
  // every pointermove during the drag would re-fire
  // useAutoLoadAnnotationsInThreedEditor and destroy + recreate every 3D
  // object.
  const runLassoLivePreview = useCallback(() => {
    lassoPreviewRafRef.current = null;
    const rect = lassoRectRef.current;
    if (!rect) return;

    const editor = threedEditorRef.current;
    const camera = editor?.sceneManager?.camera;
    const renderer = editor?.sceneManager?.renderer;
    const map = editor?.sceneManager?.annotationsManager?.annotationsObjectsMap;
    if (!camera || !renderer || !map) return;

    const canvasRect = renderer.domElement.getBoundingClientRect();
    const plane = getActiveClippingPlane(editor?.sceneManager);
    const newSet = new Set();
    for (const id in map) {
      const object = map[id];
      if (!object || object.visible === false) continue;
      const point = projectAnnotationToClient(
        object,
        camera,
        canvasRect,
        plane
      );
      if (!point) continue;
      if (
        point.x >= rect.x &&
        point.x <= rect.x + rect.width &&
        point.y >= rect.y &&
        point.y <= rect.y + rect.height
      ) {
        newSet.add(id);
      }
    }

    let changed = false;
    const prev = lassoLiveIdsRef.current;
    // Newly entered → green
    for (const id of newSet) {
      if (!prev.has(id)) {
        applyAnnotationMaterialState(map[id], STATE_HOVER);
        changed = true;
      }
    }
    // Newly left → restore non-hover state (DIM if a selection exists and id
    // not in it, else NONE). Note the "current" selection is the one BEFORE
    // the lasso commits; that's exactly the state we want during preview.
    for (const id of prev) {
      if (!newSet.has(id)) {
        applyAnnotationMaterialState(map[id], getStateForId(id, false));
        changed = true;
      }
    }
    lassoLiveIdsRef.current = newSet;
    if (changed) editor.renderScene?.();
  }, [getStateForId, projectAnnotationToClient]);

  const finalizeLasso = useCallback(() => {
    const startCoords = lassoStartRef.current;
    const rect = lassoRectRef.current;

    // Always re-enable orbit controls and clear visual state.
    const controls =
      threedEditorRef.current?.sceneManager?.controlsManager?.orbitControls;
    if (controls) controls.enabled = orbitWasEnabledRef.current;
    lassoStartRef.current = null;
    lassoRectRef.current = null;
    lassoOverlayRef.current?.clear();

    // Cancel any pending preview tick and restore items currently shown as
    // green. The dimmer effect will re-apply correct state right after the
    // selection dispatch below; this restoration just avoids a 1-frame flash
    // for items that were green during the drag.
    if (lassoPreviewRafRef.current != null) {
      cancelAnimationFrame(lassoPreviewRafRef.current);
      lassoPreviewRafRef.current = null;
    }
    if (lassoLiveIdsRef.current.size > 0) {
      const map =
        threedEditorRef.current?.sceneManager?.annotationsManager
          ?.annotationsObjectsMap || {};
      for (const id of lassoLiveIdsRef.current) {
        const obj = map[id];
        if (obj) applyAnnotationMaterialState(obj, getStateForId(id, false));
      }
      lassoLiveIdsRef.current = new Set();
      threedEditorRef.current?.renderScene?.();
    }

    if (!startCoords || !rect) return;
    // Treat tiny rectangles as a click (not a lasso) — handlePointerUp will
    // forward to handleClick which already handles shift+click.
    if (rect.width < 5 && rect.height < 5) return;

    const editor = threedEditorRef.current;
    const camera = editor?.sceneManager?.camera;
    const renderer = editor?.sceneManager?.renderer;
    const manager = editor?.sceneManager?.annotationsManager;
    if (!camera || !renderer || !manager) return;

    const canvasRect = renderer.domElement.getBoundingClientRect();
    const map = manager.annotationsObjectsMap || {};
    const plane = getActiveClippingPlane(editor?.sceneManager);

    const newItems = [];
    Object.entries(map).forEach(([id, object]) => {
      if (!object || object.visible === false) return;
      const point = projectAnnotationToClient(
        object,
        camera,
        canvasRect,
        plane
      );
      if (!point) return;
      const inside =
        point.x >= rect.x &&
        point.x <= rect.x + rect.width &&
        point.y >= rect.y &&
        point.y <= rect.y + rect.height;
      if (!inside) return;
      const {
        nodeId,
        nodeType,
        annotationType,
        listingId,
        annotationTemplateId,
      } = object.userData || {};
      if (!nodeId) return;
      newItems.push({
        id: nodeId,
        nodeId,
        type: "NODE",
        nodeType,
        annotationType,
        listingId,
        annotationTemplateId,
      });
    });

    // With "Masquer les annotations" on, the lasso selects the mailles
    // instead (only annotations OR only mailles — a mixed selection would
    // confuse the edit toolbars). Maille groups are the parents of the
    // published face meshes; their bbox center follows the annotation rule.
    if (store.getState().threedEditor.hideAnnotationsIn3d) {
      const mesh3dGroups = new Map();
      for (const faceMesh of getMesh3dFaceMeshes()) {
        const mesh3dId = faceMesh.userData?.mesh3dId;
        const group = faceMesh.parent;
        if (mesh3dId && group && !mesh3dGroups.has(mesh3dId)) {
          mesh3dGroups.set(mesh3dId, group);
        }
      }
      mesh3dGroups.forEach((group, mesh3dId) => {
        const point = projectAnnotationToClient(
          group,
          camera,
          canvasRect,
          plane
        );
        if (!point) return;
        const inside =
          point.x >= rect.x &&
          point.x <= rect.x + rect.width &&
          point.y >= rect.y &&
          point.y <= rect.y + rect.height;
        if (!inside) return;
        newItems.push({
          id: mesh3dId,
          nodeId: mesh3dId,
          type: "NODE",
          nodeType: "MESH3D",
        });
      });
    }

    // Lasso replaces the selection (matches the 2D editor).
    dispatch(setSelectedItems(newItems));
    dispatch(setSelectedNode(null));
    if (newItems.length > 0) {
      const anchor = { x: startCoords.x, y: startCoords.y };
      dispatch(setAnnotationToolbarPosition(anchor));
      dispatch(setAnnotationsToolbarPosition(anchor));
    } else {
      dispatch(setAnnotationToolbarPosition(null));
      dispatch(setAnnotationsToolbarPosition(null));
    }
  }, [dispatch, projectAnnotationToClient, getStateForId, store]);

  // Handle pointer down to detect drags
  const handlePointerDown = useCallback(
    (event) => {
      // Don't start drag tracking if clicking on popper
      if (isWithinPopper(event)) {
        return;
      }
      // Drawing mode owns the pointer.
      if (drawingActiveRef.current) {
        return;
      }
      isDraggingRef.current = false;
      dragStartRef.current = { x: event.clientX, y: event.clientY };

      // Left button = orbit gesture: set the orbit point to the point under the
      // cursor so the camera rotates around it (not the screen center).
      // camera-controls' setOrbitPoint preserves the current view, so there is
      // no jump — harmless for a plain selection click too. Skipped for the
      // shift+lasso branch below.
      const isLasso =
        event.shiftKey &&
        event.button === 0 &&
        editorModeRef.current !== "BASEMAP_POSITION";
      if (event.button === 0 && !isLasso) {
        threedEditorRef.current?.sceneManager?.controlsManager?.updateRotationPivotFromEvent(
          event
        );
      }

      // Shift+left button starts a lasso. Disable OrbitControls during the drag
      // so the camera doesn't rotate, and remember its previous state so we can
      // restore it on release. Skipped in BASEMAP_POSITION (gizmo owns the
      // pointer).
      if (isLasso) {
        lassoStartRef.current = { x: event.clientX, y: event.clientY };
        lassoRectRef.current = {
          x: event.clientX,
          y: event.clientY,
          width: 0,
          height: 0,
        };
        lassoOverlayRef.current?.setRect(lassoRectRef.current);
        const controls =
          threedEditorRef.current?.sceneManager?.controlsManager?.orbitControls;
        if (controls) {
          orbitWasEnabledRef.current = controls.enabled;
          controls.enabled = false;
        }
        // Drop any pre-existing hover state so it doesn't stay stuck green
        // while the lasso preview is in charge.
        if (prevHoveredObjectRef.current) {
          const prevId = prevHoveredObjectRef.current.userData?.nodeId;
          applyAnnotationMaterialState(
            prevHoveredObjectRef.current,
            getStateForId(prevId, false)
          );
          prevHoveredObjectRef.current = null;
        }
        lastHoveredIdRef.current = null;
        tooltipApiRef.current?.clear();
        clearFaceHoverOverlay();
      }
    },
    [isWithinPopper, getStateForId, clearFaceHoverOverlay]
  );

  // Handle pointer move to detect if user is dragging
  const handlePointerMove = useCallback(
    (event) => {
      // Don't track drag if pointer is over popper
      if (isWithinPopper(event)) {
        return;
      }
      if (dragStartRef.current.x !== 0 || dragStartRef.current.y !== 0) {
        const dx = Math.abs(event.clientX - dragStartRef.current.x);
        const dy = Math.abs(event.clientY - dragStartRef.current.y);
        if (dx > 5 || dy > 5) {
          isDraggingRef.current = true;
        }
      }
      // Update lasso rectangle during shift+drag.
      if (lassoStartRef.current) {
        const startX = lassoStartRef.current.x;
        const startY = lassoStartRef.current.y;
        const x = Math.min(startX, event.clientX);
        const y = Math.min(startY, event.clientY);
        const width = Math.abs(event.clientX - startX);
        const height = Math.abs(event.clientY - startY);
        lassoRectRef.current = { x, y, width, height };
        lassoOverlayRef.current?.setRect(lassoRectRef.current);
        // Coalesce live-preview passes into a single rAF tick so we don't
        // re-project every annotation on every pixel of pointermove.
        if (lassoPreviewRafRef.current == null) {
          lassoPreviewRafRef.current =
            requestAnimationFrame(runLassoLivePreview);
        }
      }
    },
    [isWithinPopper, runLassoLivePreview]
  );

  // Hover raycast — runs inside requestAnimationFrame to coalesce moves.
  // Important: we MUST NOT trigger a React state change on MainThreedEditor
  // here. Doing so re-runs `useAutoLoadAnnotationsInThreedEditor`, which
  // calls `loadAnnotations` and destroys + recreates every annotation 3D
  // object. The GLB then re-loads asynchronously, leaving the placeholder
  // empty at the moment we try to apply the highlight. Tooltip state lives
  // inside ThreedHoverTooltip (imperative API via tooltipApiRef).
  const runHoverRaycast = useCallback(() => {
    hoverRafRef.current = null;
    const event = lastPointerEventRef.current;
    if (!event) return;

    // While a lasso drag is in progress the live preview owns the green
    // state — let it manage which objects are highlighted. Running the hover
    // un-hover path here would overwrite the lasso preview when the cursor
    // moves off an object that's still inside the rect.
    if (lassoStartRef.current) return;
    // Hover highlight is always on — except in BASEMAP_POSITION (pointer
    // reserved for the transform gizmo), in meshing mode, which runs its
    // own hover (stipple + cursor helper) in useMeshingPointerHandlers, and
    // in PHOTOREAL: every material change invalidates the path tracer's BVH
    // (a rebuild per mousemove), and the highlight is invisible in the traced
    // image anyway.
    if (
      editorModeRef.current === "BASEMAP_POSITION" ||
      meshingActiveRef.current ||
      renderModeRef.current === "PHOTOREAL"
    ) {
      if (prevHoveredObjectRef.current) {
        const prevId = prevHoveredObjectRef.current.userData?.nodeId;
        applyAnnotationMaterialState(
          prevHoveredObjectRef.current,
          getStateForId(prevId, false)
        );
        prevHoveredObjectRef.current = null;
        threedEditorRef.current?.renderScene?.();
      }
      lastHoveredIdRef.current = null;
      tooltipApiRef.current?.clear();
      clearSubHoverHelper();
      clearFaceHoverOverlay();
      return;
    }

    const threedEditor = threedEditorRef.current;
    if (!threedEditor || !rendererIsReady || !isThreedViewer) return;
    const sceneManager = threedEditor.sceneManager;
    const renderer = sceneManager?.renderer;
    const camera = sceneManager?.camera;
    const scene = sceneManager?.scene;
    if (!renderer || !camera || !scene) return;

    const domElement = renderer.domElement;
    const rect = domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Active clipping plane (null when clipping is off) — used by every picking
    // path below to ignore geometry hidden by the cut.
    const clippingPlane = getActiveClippingPlane(sceneManager);

    // Sub-element hover (vertex / edge of the currently-selected annotation).
    // Runs before the regular face hover so the user gets fluo-green vertex /
    // edge feedback immediately after selecting a face.
    const soloId = getSoloSelectedAnnotationId();
    if (soloId) {
      const annoObject =
        sceneManager?.annotationsManager?.annotationsObjectsMap?.[soloId];
      if (annoObject?.userData?.vertexRefs?.length) {
        const cursor = { x: event.clientX, y: event.clientY };
        const vertexHit = findClosestVertexToCursor(
          annoObject,
          cursor,
          camera,
          rect,
          12,
          clippingPlane
        );
        const edgeHit = vertexHit
          ? null
          : findClosestEdgeToCursor(
              annoObject,
              cursor,
              camera,
              rect,
              8,
              clippingPlane
            );
        const nextKey = vertexHit
          ? `V:${vertexHit.index}`
          : edgeHit
            ? `E:${edgeHit.indexA}-${edgeHit.indexB}`
            : null;
        if (nextKey !== subHoverKeyRef.current) {
          if (subHoverHelperRef.current) {
            disposeSubSelectionHelper(subHoverHelperRef.current);
            subHoverHelperRef.current = null;
          }
          if (vertexHit) {
            const helper = buildVertexHelper(annoObject, vertexHit.index);
            if (helper) scene.add(helper);
            subHoverHelperRef.current = helper;
          } else if (edgeHit) {
            const helper = buildEdgeHelper(
              annoObject,
              edgeHit.indexA,
              edgeHit.indexB
            );
            if (helper) scene.add(helper);
            subHoverHelperRef.current = helper;
          }
          subHoverKeyRef.current = nextKey;
          threedEditor.renderScene?.();
        }
        if (vertexHit || edgeHit) {
          // Vertex/edge hover takes precedence — clear face hover state and
          // tooltip, return early.
          if (prevHoveredObjectRef.current) {
            const prevId = prevHoveredObjectRef.current.userData?.nodeId;
            applyAnnotationMaterialState(
              prevHoveredObjectRef.current,
              getStateForId(prevId, false)
            );
            prevHoveredObjectRef.current = null;
            threedEditor.renderScene?.();
          }
          lastHoveredIdRef.current = null;
          tooltipApiRef.current?.clear();
          clearFaceHoverOverlay();
          return;
        }
      }
    }
    // No sub-element hover this tick — make sure any leftover hover helper
    // is cleared.
    if (subHoverHelperRef.current) {
      disposeSubSelectionHelper(subHoverHelperRef.current);
      subHoverHelperRef.current = null;
      subHoverKeyRef.current = null;
      threedEditor.renderScene?.();
    }

    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycasterRef.current.setFromCamera(mouseRef.current, camera);

    // Filter out non-mesh hits (edge LineSegments) — see handleClick — hits
    // hidden by the active clipping plane (so the cursor never picks clipped-away
    // geometry, and a clipped front face doesn't shadow the object behind it),
    // and hits on hidden objects (Masquer les annotations).
    const intersects = filterIntersectionsByVisibility(
      filterIntersectionsByClipping(
        raycasterRef.current
          .intersectObjects(scene.children, true)
          .filter((i) => i.object?.isMesh),
        clippingPlane
      )
    );

    let hit = null;
    let hitIntersect = null;
    let mesh3dIntersect = null;
    for (const intersect of intersects) {
      let object = intersect.object;
      while (object) {
        // Maille (3D mesh cell) face: no annotation recolor/tooltip, but it
        // gets the same face-level stipple highlight (see overlay block).
        if (object.userData?.isMesh3d && object.userData?.mesh3dId) {
          mesh3dIntersect = intersect;
          break;
        }
        if (object.userData?.nodeId) {
          hit = object;
          hitIntersect = intersect;
          break;
        }
        object = object.parent;
      }
      if (hit || mesh3dIntersect) break;
    }

    const hitId = hit?.userData?.nodeId ?? null;
    // Fat-line hits (Line2/LineSegments2, e.g. the POINT height trait) have no
    // faces to stipple — they keep the whole-object green recolor fallback.
    const isLineHit = !!(
      hitIntersect?.object?.isLine2 || hitIntersect?.object?.isLineSegments2
    );
    const containerRect = containerRef.current?.getBoundingClientRect();

    if (hitId !== lastHoveredIdRef.current) {
      // Restore previous (no longer hovered). Selected → original; otherwise
      // dim if a selection exists, else original.
      if (prevHoveredObjectRef.current) {
        const prevId = prevHoveredObjectRef.current.userData?.nodeId;
        applyAnnotationMaterialState(
          prevHoveredObjectRef.current,
          getStateForId(prevId, false)
        );
        prevHoveredObjectRef.current = null;
      }
      if (hit) {
        // Selection wins over hover — selected annotations stay in their
        // original material even while hovered.
        applyAnnotationMaterialState(
          hit,
          getStateForId(hitId, true, isLineHit)
        );
        prevHoveredObjectRef.current = hit;
      }
      threedEditor.renderScene?.();

      lastHoveredIdRef.current = hitId;

      // Update tooltip via the child component's imperative API — no parent
      // re-render. ThreedHoverTooltip owns its own annotations subscription.
      if (hit && containerRect) {
        const { nodeId, nodeType, annotationType, listingId } = hit.userData;
        tooltipApiRef.current?.set(
          { nodeId, nodeType, annotationType, listingId },
          event.clientX - containerRect.left + 15,
          event.clientY - containerRect.top + 15
        );
      } else {
        tooltipApiRef.current?.clear();
      }
    }

    // Face hover overlay maintenance — runs every tick, NOT only on hitId
    // change: moving to another face of the SAME annotation must rebuild the
    // overlay. Staying on the same face is a cheap key match (the region is
    // stamped in the adjacency cache), so nothing is rebuilt. Maille faces get
    // the same stipple as annotation faces.
    const overlayIntersect =
      mesh3dIntersect || (hit && !isLineHit ? hitIntersect : null);
    if (!overlayIntersect) {
      clearFaceHoverOverlay();
    } else {
      const hitObject = overlayIntersect.object;
      const region = getCoplanarRegion(
        hitObject.geometry,
        overlayIntersect.faceIndex
      );
      const key = region ? `${hitObject.uuid}:${region.regionId}` : null;
      if (key !== faceHoverKeyRef.current) {
        disposeFaceHoverOverlay(faceHoverOverlayRef.current);
        faceHoverOverlayRef.current = null;
        if (region) {
          const overlay = buildFaceHoverOverlay(hitObject, region.tris);
          if (overlay) {
            hitObject.add(overlay);
            faceHoverOverlayRef.current = overlay;
          }
        }
        faceHoverKeyRef.current = key;
        threedEditor.renderScene?.();
      }
    }
  }, [
    rendererIsReady,
    isThreedViewer,
    getStateForId,
    getSoloSelectedAnnotationId,
    clearSubHoverHelper,
    clearFaceHoverOverlay,
  ]);

  // Handle pointer move (drag tracking + schedule hover raycast)
  const handleHoverPointerMove = useCallback(
    (event) => {
      lastPointerEventRef.current = event;
      if (hoverRafRef.current == null) {
        hoverRafRef.current = requestAnimationFrame(runHoverRaycast);
      }
    },
    [runHoverRaycast]
  );

  // Reset hover when the pointer leaves the canvas. Also clears the
  // ephemeral sub-selection (vertex/edge) hover helper.
  const handlePointerLeave = useCallback(() => {
    lastPointerEventRef.current = null;
    if (hoverRafRef.current != null) {
      cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = null;
    }
    if (prevHoveredObjectRef.current) {
      const prevId = prevHoveredObjectRef.current.userData?.nodeId;
      applyAnnotationMaterialState(
        prevHoveredObjectRef.current,
        getStateForId(prevId, false)
      );
      prevHoveredObjectRef.current = null;
      threedEditorRef.current?.renderScene?.();
    }
    lastHoveredIdRef.current = null;
    tooltipApiRef.current?.clear();
    clearSubHoverHelper();
    clearFaceHoverOverlay();

    // Cancel any in-flight lasso so the rectangle doesn't stay stuck on
    // screen and OrbitControls is restored.
    if (lassoStartRef.current) {
      const controls =
        threedEditorRef.current?.sceneManager?.controlsManager?.orbitControls;
      if (controls) controls.enabled = orbitWasEnabledRef.current;
      lassoStartRef.current = null;
      lassoRectRef.current = null;
      lassoOverlayRef.current?.clear();

      if (lassoPreviewRafRef.current != null) {
        cancelAnimationFrame(lassoPreviewRafRef.current);
        lassoPreviewRafRef.current = null;
      }
      if (lassoLiveIdsRef.current.size > 0) {
        const map =
          threedEditorRef.current?.sceneManager?.annotationsManager
            ?.annotationsObjectsMap || {};
        for (const id of lassoLiveIdsRef.current) {
          const obj = map[id];
          if (obj) applyAnnotationMaterialState(obj, getStateForId(id, false));
        }
        lassoLiveIdsRef.current = new Set();
        threedEditorRef.current?.renderScene?.();
      }
    }
  }, [getStateForId, clearSubHoverHelper, clearFaceHoverOverlay]);

  // Handle pointer up - if not dragging, treat as click
  const handlePointerUp = useCallback(
    (event) => {
      // Check if the click target is within a MUI Popper
      // This prevents clicks on PopperEditAnnotation from triggering the raycaster
      if (isWithinPopper(event)) {
        isDraggingRef.current = false;
        dragStartRef.current = { x: 0, y: 0 };
        return;
      }

      // If a lasso was started on shift+down: finalize it (runs hit-test if
      // the drag was significant) and skip the click path.
      if (lassoStartRef.current) {
        const rect = lassoRectRef.current;
        const wasRealDrag = rect && (rect.width >= 5 || rect.height >= 5);
        finalizeLasso();
        if (wasRealDrag) {
          isDraggingRef.current = false;
          dragStartRef.current = { x: 0, y: 0 };
          return;
        }
        // Tiny shift+drag — fall through so handleClick handles it as a
        // shift+click toggle.
      }

      if (!isDraggingRef.current) {
        // Check if the click target is within the renderer's DOM element
        // This prevents clicks on portals (like PopperEditAnnotation) from triggering the raycaster
        if (!threedEditorRef.current) {
          isDraggingRef.current = false;
          dragStartRef.current = { x: 0, y: 0 };
          return;
        }

        const renderer = threedEditorRef.current.sceneManager?.renderer;
        if (!renderer || !renderer.domElement) {
          isDraggingRef.current = false;
          dragStartRef.current = { x: 0, y: 0 };
          return;
        }

        const rendererElement = renderer.domElement;
        const clickTarget = event.target;

        // If the click is not on the renderer element or its children, ignore it
        // This handles cases where the click is on a portal (like MUI Popper)
        if (rendererElement.contains(clickTarget)) {
          // Treat as click only if it's on the renderer element
          handleClick(event);
        }
      }
      isDraggingRef.current = false;
      dragStartRef.current = { x: 0, y: 0 };
    },
    [handleClick, finalizeLasso]
  );

  // Add event listeners to renderer DOM element (only when THREED viewer is active)
  useEffect(() => {
    if (!rendererIsReady || !threedEditorRef.current || !isThreedViewer) return;

    const renderer = threedEditorRef.current.sceneManager?.renderer;
    if (!renderer || !renderer.domElement) return;

    const domElement = renderer.domElement;
    domElement.addEventListener("pointerdown", handlePointerDown);
    domElement.addEventListener("pointermove", handlePointerMove);
    domElement.addEventListener("pointermove", handleHoverPointerMove);
    domElement.addEventListener("pointerleave", handlePointerLeave);
    domElement.addEventListener("pointerup", handlePointerUp);

    return () => {
      domElement.removeEventListener("pointerdown", handlePointerDown);
      domElement.removeEventListener("pointermove", handlePointerMove);
      domElement.removeEventListener("pointermove", handleHoverPointerMove);
      domElement.removeEventListener("pointerleave", handlePointerLeave);
      domElement.removeEventListener("pointerup", handlePointerUp);
      if (hoverRafRef.current != null) {
        cancelAnimationFrame(hoverRafRef.current);
        hoverRafRef.current = null;
      }
      clearFaceHoverOverlay();
    };
  }, [
    rendererIsReady,
    handlePointerDown,
    handlePointerMove,
    handleHoverPointerMove,
    handlePointerLeave,
    handlePointerUp,
    isThreedViewer,
    clearFaceHoverOverlay,
  ]);

  // Sub-selection persistent helper: rebuild whenever the subSelection key
  // changes. Reads the full sub-selection state at apply time to access the
  // pointIds / vertexIndex fields. The helper is added to the scene so it
  // overlays the annotation regardless of the basemap group transform.
  useEffect(() => {
    if (!rendererIsReady || !threedEditorRef.current) return;
    // Dispose any prior persistent helper.
    if (subSelectedHelperRef.current) {
      disposeSubSelectionHelper(subSelectedHelperRef.current);
      subSelectedHelperRef.current = null;
    }
    if (!subSelectionKey) {
      threedEditorRef.current.renderScene?.();
      return;
    }
    const sub = store.getState().threedEditor.subSelection;
    if (!sub?.annotationId) return;
    const annoObject =
      threedEditorRef.current.sceneManager?.annotationsManager
        ?.annotationsObjectsMap?.[sub.annotationId];
    if (!annoObject) return;
    let helper = null;
    if (sub.kind === "VERTEX" && sub.vertexIndex != null) {
      helper = buildVertexHelper(annoObject, sub.vertexIndex, {
        selected: true,
      });
    } else if (
      sub.kind === "EDGE" &&
      sub.vertexIndex != null &&
      sub.vertexIndexB != null
    ) {
      helper = buildEdgeHelper(annoObject, sub.vertexIndex, sub.vertexIndexB, {
        selected: true,
      });
    }
    if (helper) {
      threedEditorRef.current.sceneManager.scene.add(helper);
      subSelectedHelperRef.current = helper;
    }
    threedEditorRef.current.renderScene?.();
  }, [subSelectionKey, rendererIsReady, store]);

  // Cleanup the persistent helper on unmount / viewer switch.
  useEffect(() => {
    if (!isThreedViewer && subSelectedHelperRef.current) {
      disposeSubSelectionHelper(subSelectedHelperRef.current);
      subSelectedHelperRef.current = null;
      threedEditorRef.current?.renderScene?.();
    }
  }, [isThreedViewer]);

  // Reset hover when leaving the 3D viewer.
  useEffect(() => {
    if (!isThreedViewer && prevHoveredObjectRef.current) {
      const prevId = prevHoveredObjectRef.current.userData?.nodeId;
      applyAnnotationMaterialState(
        prevHoveredObjectRef.current,
        getStateForId(prevId, false)
      );
      prevHoveredObjectRef.current = null;
      lastHoveredIdRef.current = null;
      tooltipApiRef.current?.clear();
      threedEditorRef.current?.renderScene?.();
    }
  }, [isThreedViewer, getStateForId]);

  return (
    <Box
      data-image-capture-host="THREED"
      sx={{
        width: 1,
        height: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid grey",
        position: "relative",
      }}
    >
      <Box sx={{ width: 1, height: 1 }} ref={containerRef} />
      {isThreedViewer && !imageModeEnabled && <PopperMapListings />}
      {isThreedViewer && <PopperEditAnnotation viewerKey="THREED" />}
      {isThreedViewer && <ThreedPopperEditAnnotations />}
      {isThreedViewer && (
        <ThreedImageModeOverlay annotations={annotations} />
      )}
      {isThreedViewer && <ThreedHoverTooltip ref={tooltipApiRef} />}
      {isThreedViewer && <ThreedLassoOverlay ref={lassoOverlayRef} />}
      {isThreedViewer && (
        <ThreedSelectionDimmer
          threedEditorRef={threedEditorRef}
          hoveredIdRef={lastHoveredIdRef}
        />
      )}
      {isThreedViewer && (
        <ThreedAnnotationsVisibility threedEditorRef={threedEditorRef} />
      )}
      {isThreedViewer && !imageModeEnabled && <TopBaseMapChipsThreed />}
      {isThreedViewer &&
        (clippingEditing ? (
          <ClippingToolbarThreed />
        ) : meshingActive ? (
          <MeshingToolbarThreed />
        ) : (
          <BottomToolbarThreed />
        ))}
      {isThreedViewer && <DrawingOverlayThreed />}
      {isThreedViewer && <MoveGizmoThreed />}
      {isThreedViewer && rendererIsReady && <ThreedDimensions />}
      {isThreedViewer && <DimensionDraftOverlayThreed />}
      {isThreedViewer && <PopperEditDimension viewerKey="THREED" />}
      {isThreedViewer && rendererIsReady && <ThreedMeshes />}
      {isThreedViewer && <MeshingOverlayThreed />}
      {isThreedViewer && <PopperEditMesh3d viewerKey="THREED" />}
      {isThreedViewer && <PopperEditMeshes3d viewerKey="THREED" />}
    </Box>
  );
}
