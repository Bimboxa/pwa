import React, { useRef, useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Raycaster, Vector2 } from "three";

import useAutoLoadShapesInThreedEditor from "Features/threedEditor/hooks/useAutoLoadShapesInThreedEditor";
import useAutoLoadMapsInThreedEditor from "../hooks/useAutoLoadMapsInThreedEditor";
import useAutoLoadAnnotationsInThreedEditor from "../hooks/useAutoLoadAnnotationsInThreedEditor";
import {
  setSelectedNode,
  setAnnotationToolbarPosition,
} from "Features/mapEditor/mapEditorSlice";

import { Box } from "@mui/material";

import ThreedEditor from "Features/threedEditor/js/ThreedEditor";
import PopperEditAnnotation from "Features/mapEditor/components/PopperEditAnnotation";

export default function MainThreedEditor() {
  // ref

  const containerRef = useRef();
  const threedEditorRef = useRef();
  const raycasterRef = useRef(new Raycaster());
  const mouseRef = useRef(new Vector2());
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // state

  const [containerElExists, setContainerElExists] = useState(false);
  const [rendererIsReady, setRendererIsReady] = useState(false); // to trigger the effect load shapes with an existing loadShapes func.

  const dispatch = useDispatch();
  const selectedViewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const isThreedViewer = selectedViewerKey === "THREED";

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

      threedEditor.renderScene();
      //animate();
    }
  }, [containerElExists]);

  // effect - load shapes

  useAutoLoadShapesInThreedEditor({
    threedEditor: threedEditorRef.current,
    rendererIsReady,
  });

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

      // Get all objects in the scene that intersect with the ray
      const intersects = raycasterRef.current.intersectObjects(
        scene.children,
        true
      );

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
    domElement.addEventListener("pointerup", handlePointerUp);

    return () => {
      domElement.removeEventListener("pointerdown", handlePointerDown);
      domElement.removeEventListener("pointermove", handlePointerMove);
      domElement.removeEventListener("pointerup", handlePointerUp);
    };
  }, [rendererIsReady, handlePointerDown, handlePointerMove, handlePointerUp, isThreedViewer]);

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
    </Box>
  );
}
