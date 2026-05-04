import React, { useRef, useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Raycaster, Vector2 } from "three";

import useAutoLoadMapsInThreedEditor from "../hooks/useAutoLoadMapsInThreedEditor";
import useAutoLoadAnnotationsInThreedEditor from "../hooks/useAutoLoadAnnotationsInThreedEditor";
import {
  setSelectedNode,
  setAnnotationToolbarPosition,
} from "Features/mapEditor/mapEditorSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import applyHoverHighlight from "Features/threedEditor/js/utilsAnnotationsManager/applyHoverHighlight";
import ThreedHoverTooltip from "./ThreedHoverTooltip";

import { Box } from "@mui/material";

import ThreedEditor from "Features/threedEditor/js/ThreedEditor";
import {
  setActiveThreedEditor,
  clearActiveThreedEditor,
} from "Features/threedEditor/services/threedEditorRegistry";
import PopperEditAnnotation from "Features/mapEditor/components/PopperEditAnnotation";
import IconButtonThreedProperties from "./IconButtonThreedProperties";

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

  // state

  const [containerElExists, setContainerElExists] = useState(false);
  const [rendererIsReady, setRendererIsReady] = useState(false); // to trigger the effect load shapes with an existing loadShapes func.

  const dispatch = useDispatch();
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const isThreedViewer = selectedViewerKey === "THREED";
  const showGrid = useSelector((s) => s.threedEditor.showGrid);

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

  useAutoLoadAnnotationsInThreedEditor({
    threedEditor: threedEditorRef.current,
    rendererIsReady,
  });

  // Click handler for raycasting
  const handleClick = useCallback(
    (event) => {
      if (!threedEditorRef.current || !rendererIsReady || !isThreedViewer) return;

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

            // Dispatch setSelectedNode
            dispatch(
              setSelectedNode({
                id: nodeId,
                nodeType,
                annotationType,
                listingId,
              })
            );

            // Dispatch into selection slice so PopperEditAnnotation
            // (which reads `selection.selectedItems` via useSelectedNodes)
            // sees the selection and renders the toolbar.
            dispatch(
              setSelectedItem({
                id: nodeId,
                nodeId,
                type: "NODE",
                nodeType,
                annotationType,
                listingId,
              })
            );

            // Dispatch setAnnotationToolbarPosition at click location
            dispatch(
              setAnnotationToolbarPosition({
                x: event.clientX,
                y: event.clientY,
              })
            );

            return; // Stop after finding the first annotation
          }
          object = object.parent;
        }
      }

      // If no annotation was clicked, deselect
      dispatch(setSelectedNode(null));
      dispatch(setSelectedItem(null));
      dispatch(setAnnotationToolbarPosition(null));
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

  // Handle pointer down to detect drags
  const handlePointerDown = useCallback((event) => {
    // Don't start drag tracking if clicking on popper
    if (isWithinPopper(event)) {
      return;
    }
    isDraggingRef.current = false;
    dragStartRef.current = { x: event.clientX, y: event.clientY };
  }, [isWithinPopper]);

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
  }, [isWithinPopper]);

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
      // Restore previous, then apply new — using fresh references from THIS
      // raycast pass (no scene.traverse needed, no useEffect lag).
      if (prevHoveredObjectRef.current) {
        applyHoverHighlight(prevHoveredObjectRef.current, false);
        prevHoveredObjectRef.current = null;
      }
      if (hit) {
        applyHoverHighlight(hit, true);
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
  }, [rendererIsReady, isThreedViewer]);

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
      applyHoverHighlight(prevHoveredObjectRef.current, false);
      prevHoveredObjectRef.current = null;
      threedEditorRef.current?.renderScene?.();
    }
    lastHoveredIdRef.current = null;
    tooltipApiRef.current?.clear();
  }, []);

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
    [handleClick]
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
      applyHoverHighlight(prevHoveredObjectRef.current, false);
      prevHoveredObjectRef.current = null;
      lastHoveredIdRef.current = null;
      tooltipApiRef.current?.clear();
      threedEditorRef.current?.renderScene?.();
    }
  }, [isThreedViewer]);

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
      {isThreedViewer && <ThreedHoverTooltip ref={tooltipApiRef} />}
      {isThreedViewer && (
        <Box sx={{ position: "absolute", top: 8, left: 8, zIndex: 1 }}>
          <IconButtonThreedProperties />
        </Box>
      )}
    </Box>
  );
}
