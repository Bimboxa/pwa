import { useEffect, useRef } from "react";

import { useSelector } from "react-redux";
import { Plane, Raycaster, Vector2, Vector3 } from "three";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import useVertexSnap from "Features/threedDrawing/hooks/useVertexSnap";

import {
  setLastMoveSnap,
  getMoveGrab,
} from "../services/moveBaseMapSessionStore";

const COLOR_VERTEX = "#ff2d8d";
const COLOR_FREE = "#000000";

const SNAP_CIRCLE_RADIUS_PX = 6;
const SNAP_CIRCLE_STROKE_PX = 2;

// Live overlay of the "Déplacer" (move base map) tool: a fixed-pixel-size SVG
// snap circle over the canvas (vertex snap on every snappable object except
// the carried base map), and — while a base map is grabbed — the live move of
// its group so the image and all its annotations follow the cursor. Mirrors
// DimensionDraftOverlayThreed.
export default function MoveBaseMapOverlayThreed() {
  const active = useSelector((s) => s.threedEditor.moveBaseMapMode.active);

  const { findNearestSnap } = useVertexSnap({ active });

  const snapCircleRef = useRef(null);

  // pointer-move: snap detection + hover marker + live group move
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

    function updateSnapCircle(snap, rect) {
      const circle = snapCircleRef.current;
      if (!circle) return;
      if (!snap?.position) {
        circle.style.display = "none";
        return;
      }
      const projected = snap.position.clone().project(camera);
      if (projected.z < -1 || projected.z > 1) {
        circle.style.display = "none";
        return;
      }
      const sx = ((projected.x + 1) / 2) * rect.width;
      const sy = ((1 - projected.y) / 2) * rect.height;
      circle.setAttribute("cx", sx);
      circle.setAttribute("cy", sy);
      circle.style.stroke = snap.kind === "VERTEX" ? COLOR_VERTEX : COLOR_FREE;
      circle.style.display = "block";
    }

    function onPointerMove(e) {
      const rect = dom.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const canvasSize = { width: rect.width, height: rect.height };

      const grab = getMoveGrab();

      const vertexSnap = findNearestSnap(ndc, camera, canvasSize, 12, {
        excludeMeshKeys: grab?.excludeMeshKeys,
      });

      let snap = vertexSnap
        ? {
            position: vertexSnap.position,
            kind: "VERTEX",
            meshKey: vertexSnap.meshKey,
          }
        : null;

      // While carrying, a free (unsnapped) cursor still moves the base map:
      // the drop point slides on the camera-facing plane through the grabbed
      // point, like the face-drawing free point.
      if (!snap && grab) {
        raycaster.setFromCamera(ndc, camera);
        camera.getWorldDirection(camDir);
        freePlane.setFromNormalAndCoplanarPoint(camDir, grab.startWorld);
        if (raycaster.ray.intersectPlane(freePlane, freeHit)) {
          snap = { position: freeHit.clone(), kind: "FREE" };
        }
      }

      setLastMoveSnap(snap);
      updateSnapCircle(snap, rect);

      // Live move: the base map group (image + annotations) follows so the
      // grabbed point lands on the current target.
      if (grab && snap?.position) {
        const group = editor?.sceneManager?.imagesManager?.getGroup(
          grab.baseMapId
        );
        if (group) {
          group.position.set(
            grab.groupStartPosition.x + (snap.position.x - grab.startWorld.x),
            grab.groupStartPosition.y + (snap.position.y - grab.startWorld.y),
            grab.groupStartPosition.z + (snap.position.z - grab.startWorld.z)
          );
        }
      }
      editor.renderScene?.();
    }

    function onPointerLeave() {
      setLastMoveSnap(null);
      if (snapCircleRef.current) snapCircleRef.current.style.display = "none";
      editor.renderScene?.();
    }

    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerleave", onPointerLeave);
    return () => {
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerleave", onPointerLeave);
      setLastMoveSnap(null);
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
