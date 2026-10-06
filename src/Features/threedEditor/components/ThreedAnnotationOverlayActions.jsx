import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";

import { selectSelectedItems } from "Features/selection/selectionSlice";
import { selectCaptureFramingActive } from "Features/viewers/utils/effectiveViewerKey";

import { Box } from "@mui/material";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";
import useIsWidestCoupledTab from "Features/layout/hooks/useIsWidestCoupledTab";
import useSelectedNodes from "Features/mapEditor/hooks/useSelectedNodes";
import ButtonCloneAnnotation from "Features/annotations/components/ButtonCloneAnnotation";
import OverlayButtonHollowOutAnnotation from "Features/annotations/components/OverlayButtonHollowOutAnnotation";
import OverlayButtonMoreAnnotationTools from "Features/annotations/components/OverlayButtonMoreAnnotationTools";

import { Box3, Vector3 } from "three";

import getAnnotationColor from "Features/annotations/utils/getAnnotationColor";
import getAnnotationHasEditTools from "Features/annotations/utils/getAnnotationHasEditTools";
import getAnnotationHasOverlayActions from "Features/annotations/utils/getAnnotationHasOverlayActions";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

const ACCENT_COLOR = "#2196f3";

// Same geometry as the 2D row (NodeSegmentLengthsStatic), screen px.
const OVERLAY_GAP_PX = 4;
const OVERLAY_H_PX = 40;
// Distance between the annotation's on-screen top edge and the row top edge.
const OVERLAY_OFFSET_PX = 50;
// Margin kept with the editor edges when the row is clamped inside it.
const EDGE_MARGIN_PX = 8;

const BOX_CORNER_SIGNS = [
  [0, 0, 0],
  [0, 0, 1],
  [0, 1, 0],
  [0, 1, 1],
  [1, 0, 0],
  [1, 0, 1],
  [1, 1, 0],
  [1, 1, 1],
];

// Quick-action row above the selected annotation in the 3D editor — the 3D
// counterpart of the 2D row (NodeSegmentLengthsStatic): "Dupliquer", "Evider"
// (POLYGON) and "Plus d'outils". ToolbarEditAnnotation drops its own copies
// under the SAME conditions (getAnnotationHasOverlayActions + interaction
// mode), so the two must stay in sync. The 2D-only toggles (move / resize
// wrapper, cotes, segment drag, angle padlock) have no 3D equivalent.
//
// Own subscriptions on purpose: a MainThreedEditor re-render rebuilds the 3D
// objects. The row is positioned imperatively (no state) at the top-center of
// the annotation's on-screen bounding box and follows the camera.
export default function ThreedAnnotationOverlayActions() {
  // data

  const annotation = useSelectedAnnotation();
  const { node: selectedNode } = useSelectedNodes();
  const selectedItems = useSelector(selectSelectedItems);
  const interactionMode = useSelector(
    (s) => s.popperMapListings?.interactionMode
  );
  const walkActive = useSelector((s) => s.threedEditor.walkMode.active);
  // Clicked point (MainThreedEditor handleClick, world space): the row sits
  // just above it. Bbox fallback when the anchor is not this annotation's
  // (selection from a panel, from the 2D editor...).
  const clickAnchor = useSelector((s) => s.mapEditor.annotationOverlayAnchor);
  const captureFramingActive = useSelector(selectCaptureFramingActive);
  const isWidest = useIsWidestCoupledTab();

  const rowRef = useRef(null);

  // helpers

  const annotationId = annotation?.id;

  const active =
    Boolean(annotationId) &&
    !String(annotationId).startsWith("temp") &&
    selectedItems.length === 1 &&
    selectedNode?.nodeType === "ANNOTATION" &&
    isWidest &&
    !walkActive &&
    !captureFramingActive &&
    getAnnotationHasOverlayActions(annotation) &&
    (interactionMode == null || interactionMode === "EDIT");

  const showHollowOutButton = annotation?.type === "POLYGON";
  const showMoreButton = getAnnotationHasEditTools(annotation);

  // effects - follow the annotation on screen

  useEffect(() => {
    if (!active) return;

    const sceneManager = getActiveThreedEditor()?.sceneManager;
    const annotationsManager = sceneManager?.annotationsManager;
    if (!sceneManager || !annotationsManager) return;

    const box = new Box3();
    const corner = new Vector3();
    const clickPoint =
      clickAnchor?.space === "WORLD_3D" &&
      clickAnchor.annotationId === annotationId
        ? new Vector3(clickAnchor.x, clickAnchor.y, clickAnchor.z)
        : null;

    // Top-center of the on-screen bbox (the 8 projected corners) of the
    // annotation object, canvas px — null when it cannot be placed.
    const projectBoxTopCenter = (object) => {
      const camera = sceneManager.camera;
      const canvasRect = sceneManager.renderer.domElement.getBoundingClientRect();
      box.setFromObject(object);
      if (box.isEmpty()) return null;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let allVisible = true;
      for (const [sx, sy, sz] of BOX_CORNER_SIGNS) {
        corner
          .set(
            sx ? box.max.x : box.min.x,
            sy ? box.max.y : box.min.y,
            sz ? box.max.z : box.min.z
          )
          .project(camera);
        if (corner.z < -1 || corner.z > 1) {
          allVisible = false;
          break;
        }
        const x = (corner.x * 0.5 + 0.5) * canvasRect.width;
        const y = (-corner.y * 0.5 + 0.5) * canvasRect.height;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
      }
      if (allVisible) return [(minX + maxX) / 2, minY];
      // Part of the box is behind the camera (close-up): fall back to the
      // box center, hidden when that one is out of the frustum too.
      box.getCenter(corner).project(camera);
      if (
        corner.z < -1 ||
        corner.z > 1 ||
        Math.abs(corner.x) > 1 ||
        Math.abs(corner.y) > 1
      )
        return null;
      return [
        (corner.x * 0.5 + 0.5) * canvasRect.width,
        (-corner.y * 0.5 + 0.5) * canvasRect.height,
      ];
    };

    const update = () => {
      const row = rowRef.current;
      const host = row?.parentElement;
      if (!row || !host) return;

      // Looked up on every update: an async rebuild (CSG carve, GLB load)
      // swaps the root object.
      const object = annotationsManager.annotationsObjectsMap?.[annotationId];
      const camera = sceneManager.camera;
      const canvasRect = sceneManager.renderer?.domElement?.getBoundingClientRect();
      if (!object || !camera || !canvasRect?.width || !canvasRect?.height) {
        row.style.visibility = "hidden";
        return;
      }

      camera.updateMatrixWorld();

      let anchorX;
      let anchorY;
      if (clickPoint) {
        corner.copy(clickPoint).project(camera);
        if (corner.z < -1 || corner.z > 1) {
          row.style.visibility = "hidden";
          return;
        }
        anchorX = (corner.x * 0.5 + 0.5) * canvasRect.width;
        anchorY = (-corner.y * 0.5 + 0.5) * canvasRect.height;
      } else {
        const projected = projectBoxTopCenter(object);
        if (!projected) {
          row.style.visibility = "hidden";
          return;
        }
        [anchorX, anchorY] = projected;
      }

      // Canvas px → host px, then clamp inside the host so the actions stay
      // reachable when the annotation is partly out of view.
      const hostRect = host.getBoundingClientRect();
      const rowWidth = row.offsetWidth;
      const maxLeft = hostRect.width - rowWidth - EDGE_MARGIN_PX;
      const maxTop = hostRect.height - OVERLAY_H_PX - EDGE_MARGIN_PX;
      const left = Math.min(
        Math.max(
          canvasRect.left - hostRect.left + anchorX - rowWidth / 2,
          EDGE_MARGIN_PX
        ),
        Math.max(maxLeft, EDGE_MARGIN_PX)
      );
      const top = Math.min(
        Math.max(
          canvasRect.top - hostRect.top + anchorY - OVERLAY_OFFSET_PX,
          EDGE_MARGIN_PX
        ),
        Math.max(maxTop, EDGE_MARGIN_PX)
      );

      row.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
      row.style.visibility = "visible";
    };

    let rafId = null;
    const scheduleUpdate = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        update();
      });
    };

    update();

    // camera-controls "update" fires on every camera pose change.
    const cameraControls = sceneManager.controlsManager?.cameraControls;
    cameraControls?.addEventListener("update", scheduleUpdate);
    const unsubscribeReady =
      annotationsManager.subscribeAnnotationReady?.(scheduleUpdate);
    const host = rowRef.current?.parentElement;
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    if (host) resizeObserver.observe(host);

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      cameraControls?.removeEventListener("update", scheduleUpdate);
      unsubscribeReady?.();
      resizeObserver.disconnect();
    };
  }, [
    active,
    annotationId,
    annotation,
    clickAnchor,
    showHollowOutButton,
    showMoreButton,
  ]);

  // render

  if (!active) return null;

  return (
    <Box
      ref={rowRef}
      data-interaction="ui-overlay"
      data-capture-hide
      sx={{
        position: "absolute",
        top: 0,
        left: 0,
        // Under the edit toolbar (PopperEditAnnotation, zIndex 1000).
        zIndex: 900,
        height: OVERLAY_H_PX,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: `${OVERLAY_GAP_PX}px`,
        // Hidden until the first projection places it.
        visibility: "hidden",
      }}
    >
      <ButtonCloneAnnotation
        key={annotationId}
        variant="overlay"
        accentColor={getAnnotationColor(annotation) || "#6366F1"}
        overlayColor={ACCENT_COLOR}
      />
      {showHollowOutButton && (
        <OverlayButtonHollowOutAnnotation
          annotation={annotation}
          overlayColor={ACCENT_COLOR}
          showHotkey={false}
        />
      )}
      {showMoreButton && (
        <OverlayButtonMoreAnnotationTools
          annotation={annotation}
          overlayColor={ACCENT_COLOR}
        />
      )}
    </Box>
  );
}
