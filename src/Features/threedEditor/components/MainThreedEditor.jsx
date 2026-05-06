import React, { useRef, useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";
import { Box3, Raycaster, Vector2, Vector3 } from "three";

import useAutoLoadMapsInThreedEditor from "../hooks/useAutoLoadMapsInThreedEditor";
import useAutoLoadAnnotationsInThreedEditor from "../hooks/useAutoLoadAnnotationsInThreedEditor";
import useDeleteAnnotationOnKeyboardInThreedEditor from "../hooks/useDeleteAnnotationOnKeyboardInThreedEditor";
import useApplyBaseMapOpacityIn3d from "../hooks/useApplyBaseMapOpacityIn3d";
import {
  setSelectedNode,
  setAnnotationToolbarPosition,
  setAnnotationsToolbarPosition,
} from "Features/mapEditor/mapEditorSlice";
import {
  setSelectedItem,
  setSelectedItems,
  toggleItemSelection,
} from "Features/selection/selectionSlice";

import applyAnnotationMaterialState, {
  // states
  STATE_DIM,
  STATE_HOVER,
  STATE_NONE,
} from "Features/threedEditor/js/utilsAnnotationsManager/applyAnnotationMaterialState";
import ThreedHoverTooltip from "./ThreedHoverTooltip";
import ThreedLassoOverlay from "./ThreedLassoOverlay";
import ThreedPopperEditAnnotations from "./ThreedPopperEditAnnotations";
import ThreedSelectionDimmer from "./ThreedSelectionDimmer";

import { Box } from "@mui/material";

import ThreedEditor from "Features/threedEditor/js/ThreedEditor";
import {
  setActiveThreedEditor,
  clearActiveThreedEditor,
} from "Features/threedEditor/services/threedEditorRegistry";
import PopperEditAnnotation from "Features/mapEditor/components/PopperEditAnnotation";
import IconButtonThreedProperties from "./IconButtonThreedProperties";
import ToggleEditorModeThreed from "./ToggleEditorModeThreed";
import PanelBaseMapPosition3D from "./PanelBaseMapPosition3D";

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
  const isThreedViewer = selectedViewerKey === "THREED";
  const showGrid = useSelector((s) => s.threedEditor.showGrid);
  // Mirror editorMode into a ref so pointer handlers can read the current
  // value without depending on state — re-creating the handlers would
  // invalidate the registered listeners and break drag tracking mid-stream.
  const editorMode = useSelector((s) => s.threedEditor.editorMode);
  const editorModeRef = useRef(editorMode);
  useEffect(() => {
    editorModeRef.current = editorMode;
  }, [editorMode]);

  // Helper: derive the right material state for a given annotation id, based
  // on the current selection in the store and whether the cursor is currently
  // over it. Selection wins over hover — a selected annotation always shows
  // its original material, even while hovered.
  const getStateForId = useCallback(
    (id, isHovered) => {
      const items = store.getState().selection.selectedItems || [];
      const ids = items
        .filter((i) => i.type === "NODE" && i.nodeType === "ANNOTATION")
        .map((i) => i.nodeId || i.id);
      if (ids.includes(id)) return STATE_NONE;
      if (isHovered) return STATE_HOVER;
      if (ids.length > 0) return STATE_DIM;
      return STATE_NONE;
    },
    [store]
  );

  // Sync showGrid → sceneManager.grid.visible (and re-render)
  useEffect(() => {
    const editor = threedEditorRef.current;
    if (!editor || !rendererIsReady) return;
    const grid = editor.sceneManager?.grid;
    if (!grid) return;
    grid.visible = showGrid;
    editor.renderScene();
  }, [showGrid, rendererIsReady]);

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
        clearActiveThreedEditor();
      };
    }
  }, [containerElExists]);

  useAutoLoadMapsInThreedEditor({
    threedEditor: threedEditorRef.current,
    rendererIsReady,
  });

  useApplyBaseMapOpacityIn3d();

  const annotations = useAutoLoadAnnotationsInThreedEditor({
    threedEditor: threedEditorRef.current,
    rendererIsReady,
  });

  useDeleteAnnotationOnKeyboardInThreedEditor({ annotations });

  // Click handler for raycasting
  const handleClick = useCallback(
    (event) => {
      if (!threedEditorRef.current || !rendererIsReady || !isThreedViewer) return;
      // In BASEMAP_POSITION mode the pointer is reserved for the transform
      // gizmo and the camera — annotation selection is intentionally disabled.
      if (editorModeRef.current === "BASEMAP_POSITION") return;

      const threedEditor = threedEditorRef.current;
      const sceneManager = threedEditor.sceneManager;
      const renderer = sceneManager.renderer;
      const camera = sceneManager.camera;
      const scene = sceneManager.scene;

      if (!renderer || !camera || !scene) return;

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
      const intersects = raycasterRef.current
        .intersectObjects(scene.children, true)
        .filter((i) => i.object?.isMesh);

      // Find the first annotation object (check userData)
      for (const intersect of intersects) {
        let object = intersect.object;

        // Traverse up the object hierarchy to find the parent Group with userData
        // This handles cases where child meshes (walls, caps, edges) are clicked
        while (object) {
          if (object.userData?.nodeId) {
            const { nodeId, nodeType, annotationType, listingId } =
              object.userData;
            const item = {
              id: nodeId,
              nodeId,
              type: "NODE",
              nodeType,
              annotationType,
              listingId,
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
                  nodeType,
                  annotationType,
                  listingId,
                })
              );
              // Replace the selection — PopperEditAnnotation (singular) reads
              // `selection.selectedItems` via useSelectedNodes.
              dispatch(setSelectedItem(item));
            }

            // Anchor both toolbars at the click — the singular renders when
            // exactly one item is selected, the plural when 2+ are selected.
            dispatch(setAnnotationToolbarPosition(position));
            dispatch(setAnnotationsToolbarPosition(position));

            return; // Stop after finding the first annotation
          }
          object = object.parent;
        }
      }

      // No annotation hit. Shift+click on empty preserves the selection
      // (mirrors the 2D editor behavior); plain click deselects.
      if (!event.shiftKey) {
        dispatch(setSelectedNode(null));
        dispatch(setSelectedItem(null));
        dispatch(setAnnotationToolbarPosition(null));
        dispatch(setAnnotationsToolbarPosition(null));
      }
    },
    [dispatch, rendererIsReady, isThreedViewer]
  );

  // Helper to check if an event target is within a MUI Popper or portal
  const isWithinPopper = useCallback((event) => {
    if (!event || !event.target) return false;
    
    // Use composedPath to get all elements in the event path (including portals)
    const path = event.composedPath ? event.composedPath() : [];
    
    // Check all elements in the path
    for (const element of path) {
      if (!element || typeof element.classList === 'undefined') continue;
      
      // Check for MUI Popper classes
      const classList = element.classList;
      if (classList) {
        for (const className of classList) {
          if (className.includes("MuiPopper") || 
              className.includes("MuiPaper") ||
              className.includes("MuiBox")) {
            // Additional check: make sure it's actually a popper, not just any MUI component
            if (className.includes("MuiPopper") || 
                element.closest?.(".MuiPopper-root")) {
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
  const projectAnnotationToClient = useCallback((object3D, camera, canvasRect) => {
    const box = new Box3();
    box.makeEmpty();
    box.setFromObject(object3D);
    if (box.isEmpty() || !isFinite(box.min.x)) return null;
    const center = new Vector3();
    box.getCenter(center);
    center.project(camera); // → NDC space [-1, 1]
    const sx = canvasRect.left + (center.x * 0.5 + 0.5) * canvasRect.width;
    const sy = canvasRect.top + (-center.y * 0.5 + 0.5) * canvasRect.height;
    return { x: sx, y: sy };
  }, []);

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
    const newSet = new Set();
    for (const id in map) {
      const object = map[id];
      if (!object) continue;
      const point = projectAnnotationToClient(object, camera, canvasRect);
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
    const controls = threedEditorRef.current?.sceneManager?.controlsManager?.orbitControls;
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

    const newItems = [];
    Object.entries(map).forEach(([id, object]) => {
      if (!object) return;
      const point = projectAnnotationToClient(object, camera, canvasRect);
      if (!point) return;
      const inside =
        point.x >= rect.x &&
        point.x <= rect.x + rect.width &&
        point.y >= rect.y &&
        point.y <= rect.y + rect.height;
      if (!inside) return;
      const { nodeId, nodeType, annotationType, listingId } = object.userData || {};
      if (!nodeId) return;
      newItems.push({
        id: nodeId,
        nodeId,
        type: "NODE",
        nodeType,
        annotationType,
        listingId,
      });
    });

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
  }, [dispatch, projectAnnotationToClient, getStateForId]);

  // Handle pointer down to detect drags
  const handlePointerDown = useCallback((event) => {
    // Don't start drag tracking if clicking on popper
    if (isWithinPopper(event)) {
      return;
    }
    isDraggingRef.current = false;
    dragStartRef.current = { x: event.clientX, y: event.clientY };

    // Shift+left button starts a lasso. Disable OrbitControls during the drag
    // so the camera doesn't rotate, and remember its previous state so we can
    // restore it on release.
    // Only in SELECTION mode — in NAVIGATION mode shift+drag falls through
    // to OrbitControls (camera pan/orbit).
    if (
      event.shiftKey &&
      event.button === 0 &&
      editorModeRef.current === "SELECTION"
    ) {
      lassoStartRef.current = { x: event.clientX, y: event.clientY };
      lassoRectRef.current = { x: event.clientX, y: event.clientY, width: 0, height: 0 };
      lassoOverlayRef.current?.setRect(lassoRectRef.current);
      const controls = threedEditorRef.current?.sceneManager?.controlsManager?.orbitControls;
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
    }
  }, [isWithinPopper, getStateForId]);

  // Handle pointer move to detect if user is dragging
  const handlePointerMove = useCallback((event) => {
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
        lassoPreviewRafRef.current = requestAnimationFrame(runLassoLivePreview);
      }
    }
  }, [isWithinPopper, runLassoLivePreview]);

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
    // Hover highlight only fires in SELECTION mode — in NAVIGATION the user
    // is orbiting the camera, in BASEMAP_POSITION they're moving the basemap.
    if (editorModeRef.current !== "SELECTION") {
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

    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycasterRef.current.setFromCamera(mouseRef.current, camera);

    // Filter out non-mesh hits (edge LineSegments) — see handleClick.
    const intersects = raycasterRef.current
      .intersectObjects(scene.children, true)
      .filter((i) => i.object?.isMesh);

    let hit = null;
    for (const intersect of intersects) {
      let object = intersect.object;
      while (object) {
        if (object.userData?.nodeId) {
          hit = object;
          break;
        }
        object = object.parent;
      }
      if (hit) break;
    }

    const hitId = hit?.userData?.nodeId ?? null;
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
        applyAnnotationMaterialState(hit, getStateForId(hitId, true));
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
  }, [rendererIsReady, isThreedViewer, getStateForId]);

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

  // Reset hover when the pointer leaves the canvas.
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

    // Cancel any in-flight lasso so the rectangle doesn't stay stuck on
    // screen and OrbitControls is restored.
    if (lassoStartRef.current) {
      const controls = threedEditorRef.current?.sceneManager?.controlsManager?.orbitControls;
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
  }, [getStateForId]);

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
    };
  }, [
    rendererIsReady,
    handlePointerDown,
    handlePointerMove,
    handleHoverPointerMove,
    handlePointerLeave,
    handlePointerUp,
    isThreedViewer,
  ]);

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
      {isThreedViewer && <PopperEditAnnotation viewerKey="THREED" />}
      {isThreedViewer && <ThreedPopperEditAnnotations />}
      {isThreedViewer && <ThreedHoverTooltip ref={tooltipApiRef} />}
      {isThreedViewer && <ThreedLassoOverlay ref={lassoOverlayRef} />}
      {isThreedViewer && (
        <ThreedSelectionDimmer
          threedEditorRef={threedEditorRef}
          hoveredIdRef={lastHoveredIdRef}
        />
      )}
      {isThreedViewer && (
        <Box
          sx={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 1,
            display: "flex",
            gap: 1,
          }}
        >
          <IconButtonThreedProperties />
          <ToggleEditorModeThreed />
        </Box>
      )}
      {isThreedViewer && editorMode === "BASEMAP_POSITION" && (
        <PanelBaseMapPosition3D />
      )}
    </Box>
  );
}
