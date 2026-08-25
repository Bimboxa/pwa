import { useEffect, useRef } from "react";

import { useSelector } from "react-redux";
import { Plane, Raycaster, Vector2, Vector3 } from "three";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import findNearestEdgeSnap from "Features/threedDimensions/utils/findNearestEdgeSnap";
import findNearestVertexInVerts from "Features/threedBaseMapMove/utils/findNearestVertexInVerts";
import intersectBaseMapPlane from "Features/threedBaseMapMove/utils/intersectBaseMapPlane";

import useAnnotationsOnlyVertexSnap from "../hooks/useAnnotationsOnlyVertexSnap";
import applyMoveAnnotationsPose from "../utils/applyMoveAnnotationsPose";
import {
  setLastMoveAnnotationSnap,
  getMoveAnnotationGrab,
} from "../services/moveAnnotationSessionStore";

const COLOR_VERTEX = "#ff2d8d";
const COLOR_EDGE = "#2e7d32";
const COLOR_PLANE = "#1565c0";
const COLOR_CROSS = "#90a4ae";
const COLOR_FREE = "#000000";

const SNAP_CIRCLE_RADIUS_PX = 6;
const SNAP_CIRCLE_STROKE_PX = 2;

// Live overlay of the "Déplacer" (move annotation) tool — mirrors
// MoveBaseMapOverlayThreed. Grab phase: vertex snap on ANNOTATION geometry
// only (the first click must land on an annotation). Carry phase: the
// carried annotation roots follow the cursor in their base map's plane;
// drop targets snap on the target-only index (vertex, then edge), then a
// direct hit on a base map image plane (point + edge-parallel cross), then
// a camera-facing free plane through the grabbed point.
export default function MoveAnnotationOverlayThreed() {
  const active = useSelector((s) => s.threedEditor.moveAnnotationMode.active);

  const { findNearestSnap } = useAnnotationsOnlyVertexSnap({ active });

  const snapCircleRef = useRef(null);
  const crossARef = useRef(null);
  const crossBRef = useRef(null);

  // pointer-move: snap detection + hover marker + live annotations move
  useEffect(() => {
    if (!active) return;
    const editor = getActiveThreedEditor();
    const dom = editor?.sceneManager?.renderer?.domElement;
    const camera = editor?.sceneManager?.camera;
    if (!dom || !camera) return;

    const ndc = new Vector2();
    const raycaster = new Raycaster();
    const freePlane = new Plane();
    const camDir = new Vector3();
    const freeHit = new Vector3();

    function toScreen(worldPos, rect) {
      const projected = worldPos.clone().project(camera);
      if (projected.z < -1 || projected.z > 1) return null;
      return {
        sx: ((projected.x + 1) / 2) * rect.width,
        sy: ((1 - projected.y) / 2) * rect.height,
      };
    }

    function updateSnapCircle(snap, rect) {
      const circle = snapCircleRef.current;
      if (!circle) return;
      const screen = snap?.position ? toScreen(snap.position, rect) : null;
      if (!screen) {
        circle.style.display = "none";
        return;
      }
      circle.setAttribute("cx", screen.sx);
      circle.setAttribute("cy", screen.sy);
      circle.style.stroke =
        snap.kind === "VERTEX"
          ? COLOR_VERTEX
          : snap.kind === "EDGE"
            ? COLOR_EDGE
            : snap.kind === "PLANE"
              ? COLOR_PLANE
              : COLOR_FREE;
      circle.style.display = "block";
    }

    // Cross helper of a PLANE hit: the two dashed lines through the point,
    // parallel to the plane's edges, ending on its borders.
    function updateCross(snap, rect) {
      const show = snap?.kind === "PLANE" && snap.axisA && snap.axisB;
      [
        [crossARef, snap?.axisA],
        [crossBRef, snap?.axisB],
      ].forEach(([ref, axis]) => {
        const el = ref.current;
        if (!el) return;
        const a = show ? toScreen(axis[0], rect) : null;
        const b = show ? toScreen(axis[1], rect) : null;
        if (!a || !b) {
          el.style.display = "none";
          return;
        }
        el.setAttribute("x1", a.sx);
        el.setAttribute("y1", a.sy);
        el.setAttribute("x2", b.sx);
        el.setAttribute("y2", b.sy);
        el.style.display = "block";
      });
    }

    function onPointerMove(e) {
      const rect = dom.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const canvasSize = { width: rect.width, height: rect.height };

      const grab = getMoveAnnotationGrab();

      let snap = null;
      if (grab) {
        // Carrying: search the target-only index built at grab time (the
        // carried roots are excluded, so their geometry never screens the
        // drop targets) — vertex first, then edge, then a base map plane.
        snap =
          findNearestVertexInVerts(
            grab.targetVerts,
            ndc,
            camera,
            canvasSize,
            12
          ) ??
          findNearestEdgeSnap(
            grab.targetAdjacency,
            ndc,
            camera,
            canvasSize,
            12
          );
        if (!snap) {
          const planeHit = intersectBaseMapPlane(editor, ndc, camera);
          if (planeHit) {
            snap = {
              position: planeHit.position,
              kind: "PLANE",
              baseMapId: planeHit.baseMapId,
              axisA: planeHit.axisA,
              axisB: planeHit.axisB,
            };
          }
        }
        // A free (unsnapped) cursor still moves the annotations: the drop
        // point slides on the camera-facing plane through the grabbed point.
        if (!snap) {
          raycaster.setFromCamera(ndc, camera);
          camera.getWorldDirection(camDir);
          freePlane.setFromNormalAndCoplanarPoint(camDir, grab.startWorld);
          if (raycaster.ray.intersectPlane(freePlane, freeHit)) {
            snap = { position: freeHit.clone(), kind: "FREE" };
          }
        }
      } else {
        // Grab phase: annotation vertices only — no base map plane
        // fallback, the first click must land on an annotation.
        snap = findNearestSnap(ndc, camera, canvasSize, 12);
      }

      setLastMoveAnnotationSnap(snap);
      updateSnapCircle(snap, rect);
      updateCross(grab ? snap : null, rect);

      // Live move: the carried annotation roots follow so the grabbed point
      // lands on the current target (in-plane, local Z dropped).
      if (grab && snap?.position) {
        applyMoveAnnotationsPose(editor, grab, snap.position);
      }
      editor.renderScene?.();
    }

    function onPointerLeave() {
      setLastMoveAnnotationSnap(null);
      if (snapCircleRef.current) snapCircleRef.current.style.display = "none";
      if (crossARef.current) crossARef.current.style.display = "none";
      if (crossBRef.current) crossBRef.current.style.display = "none";
      editor.renderScene?.();
    }

    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerleave", onPointerLeave);
    return () => {
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerleave", onPointerLeave);
      setLastMoveAnnotationSnap(null);
    };
  }, [active, findNearestSnap]);

  if (!active) return null;
  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      <line
        ref={crossARef}
        stroke={COLOR_CROSS}
        strokeWidth="1.5"
        strokeDasharray="5 4"
        style={{ display: "none" }}
      />
      <line
        ref={crossBRef}
        stroke={COLOR_CROSS}
        strokeWidth="1.5"
        strokeDasharray="5 4"
        style={{ display: "none" }}
      />
      <circle
        ref={snapCircleRef}
        r={SNAP_CIRCLE_RADIUS_PX}
        strokeWidth={SNAP_CIRCLE_STROKE_PX}
        fill="none"
        style={{ display: "none" }}
      />
    </svg>
  );
}
