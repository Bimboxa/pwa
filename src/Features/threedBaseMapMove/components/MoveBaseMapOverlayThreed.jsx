import { useEffect, useRef } from "react";

import { useSelector } from "react-redux";
import { Plane, Raycaster, Vector2, Vector3 } from "three";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import { AXIS_COLORS } from "Features/threedEditor/constants/axesDisplay";
import getUserAxesWorldDirections from "Features/threedEditor/utils/getUserAxesWorldDirections";
import useVertexSnap from "Features/threedDrawing/hooks/useVertexSnap";
import { poseRevolutionFollowers } from "Features/threedEditor/js/utilsAnnotationsManager/revolutionFollowers";

import DrawingLengthBadge from "Features/mapEditorGeneric/components/DrawingLengthBadge";
import findNearestEdgeSnap from "Features/threedDimensions/utils/findNearestEdgeSnap";
import computeAxisLockSnap from "Features/threedAnnotationMove/utils/computeAxisLockSnap";
import { formatMoveBadge } from "Features/annotationTransform/utils/copyBuffer";
import findNearestVertexInVerts from "../utils/findNearestVertexInVerts";
import intersectBaseMapPlane from "../utils/intersectBaseMapPlane";
import {
  setLastMoveSnap,
  getMoveGrab,
} from "../services/moveBaseMapSessionStore";

const COLOR_VERTEX = "#ff2d8d";
const COLOR_EDGE = "#2e7d32";
const COLOR_PLANE = "#1565c0";
const COLOR_CROSS = "#90a4ae";
const COLOR_FREE = "#000000";

const SNAP_CIRCLE_RADIUS_PX = 6;
const SNAP_CIRCLE_STROKE_PX = 2;

// Live overlay of the "Déplacer" (move base map) tool: a fixed-pixel-size SVG
// snap circle over the canvas (vertex snap on every snappable object except
// the carried base map), and — while a base map is grabbed — the live move of
// its group so the image and all its annotations follow the cursor. Mirrors
// DimensionDraftOverlayThreed.
// Shift while carrying: ortho lock — the destination is locked on the user
// axis (X / Y / Z of the gizmo frame) through the grabbed point closest to
// the cursor, the snaps are ignored, the axis line is drawn in its colour
// and the badge shows the travelled length (same mechanism as the
// annotation move tool, MoveAnnotationOverlayThreed).
export default function MoveBaseMapOverlayThreed() {
  const active = useSelector((s) => s.threedEditor.moveBaseMapMode.active);
  const yawDeg = useSelector((s) => s.threedEditor.axesSettings.yawDeg);

  const { findNearestSnap } = useVertexSnap({ active });

  const snapCircleRef = useRef(null);
  const crossARef = useRef(null);
  const crossBRef = useRef(null);
  const axisLineRef = useRef(null);
  const badgeRef = useRef(null);
  // Read inside the pointer handlers without re-attaching them.
  const yawDegRef = useRef(yawDeg);
  yawDegRef.current = yawDeg;

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
    // Last pointer position: replayed when Shift is pressed / released
    // without a pointer move.
    let lastPointer = null;
    let lastShiftKey = false;

    function toScreen(worldPos, rect) {
      const projected = worldPos.clone().project(camera);
      if (projected.z < -1 || projected.z > 1) return null;
      return {
        sx: ((projected.x + 1) / 2) * rect.width,
        sy: ((1 - projected.y) / 2) * rect.height,
      };
    }

    function colorOfSnap(snap) {
      if (snap.kind === "VERTEX") return COLOR_VERTEX;
      if (snap.kind === "EDGE") return COLOR_EDGE;
      if (snap.kind === "PLANE") return COLOR_PLANE;
      if (snap.kind === "AXIS") return AXIS_COLORS[snap.axis] ?? COLOR_FREE;
      return COLOR_FREE;
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
      circle.style.stroke = colorOfSnap(snap);
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

    // Shift ortho lock: the axis line from the grabbed point to the locked
    // destination, in the axis colour.
    function updateAxisLock(grab, snap, rect) {
      const line = axisLineRef.current;
      if (!line) return;
      const show = grab && snap?.kind === "AXIS";
      const a = show ? toScreen(grab.startWorld, rect) : null;
      const b = show ? toScreen(snap.position, rect) : null;
      if (!a || !b) {
        line.style.display = "none";
        return;
      }
      line.setAttribute("x1", a.sx);
      line.setAttribute("y1", a.sy);
      line.setAttribute("x2", b.sx);
      line.setAttribute("y2", b.sy);
      line.style.stroke = AXIS_COLORS[snap.axis] ?? COLOR_FREE;
      line.style.display = "block";
    }

    // Badge under the cursor while carrying: the travelled distance, in the
    // axis colour under a Shift lock.
    function updateBadge(grab, snap, rect) {
      const badge = badgeRef.current;
      if (!badge) return;
      const screen =
        grab && snap?.position ? toScreen(snap.position, rect) : null;
      if (!screen) {
        badge.hide?.();
        return;
      }
      const lengthM = snap.position.distanceTo(grab.startWorld);
      const text = formatMoveBadge({
        lengthM,
        axis: snap.kind === "AXIS" ? snap.axis : null,
      });
      badge.update?.({
        x: screen.sx,
        y: screen.sy,
        text,
        color: snap.kind === "AXIS" ? AXIS_COLORS[snap.axis] : undefined,
      });
    }

    function computeSnap(grab, shiftKey, canvasSize) {
      if (!grab) {
        // Grab phase: vertex snap on every snappable object, else a direct
        // hit on a base map image plane (point + edge-parallel cross) so a
        // base map can be grabbed from its image too.
        const vertexSnap = findNearestSnap(ndc, camera, canvasSize, 12);
        if (vertexSnap) {
          return {
            position: vertexSnap.position,
            kind: "VERTEX",
            meshKey: vertexSnap.meshKey,
          };
        }
        // Cross arms along the user axes of the gizmo frame.
        const planeHit = intersectBaseMapPlane(editor, ndc, camera, {
          axes: getUserAxesWorldDirections(yawDegRef.current),
        });
        if (planeHit) {
          return {
            position: planeHit.position,
            kind: "PLANE",
            baseMapId: planeHit.baseMapId,
            axisA: planeHit.axisA,
            axisB: planeHit.axisB,
          };
        }
        return null;
      }
      if (shiftKey) {
        const lock = computeAxisLockSnap({
          mouseNdc: ndc,
          camera,
          canvasSize,
          origin: grab.startWorld,
          axes: getUserAxesWorldDirections(yawDegRef.current),
          raycaster,
        });
        if (lock)
          return { position: lock.position, kind: "AXIS", axis: lock.axis };
      }
      // Carrying: search the target-only index built at grab time (the
      // carried subtree is excluded, so its geometry never screens the
      // drop targets) — vertex first, then edge, like the cote tool.
      let snap =
        findNearestVertexInVerts(
          grab.targetVerts,
          ndc,
          camera,
          canvasSize,
          12
        ) ??
        findNearestEdgeSnap(grab.targetAdjacency, ndc, camera, canvasSize, 12);
      // A free (unsnapped) cursor still moves the base map: the drop point
      // slides on the camera-facing plane through the grabbed point.
      if (!snap) {
        raycaster.setFromCamera(ndc, camera);
        camera.getWorldDirection(camDir);
        freePlane.setFromNormalAndCoplanarPoint(camDir, grab.startWorld);
        if (raycaster.ray.intersectPlane(freePlane, freeHit)) {
          snap = { position: freeHit.clone(), kind: "FREE" };
        }
      }
      return snap;
    }

    function update({ clientX, clientY, shiftKey }) {
      const rect = dom.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      const canvasSize = { width: rect.width, height: rect.height };

      const grab = getMoveGrab();
      const snap = computeSnap(grab, shiftKey, canvasSize);

      setLastMoveSnap(snap);
      updateSnapCircle(snap, rect);
      updateCross(grab ? null : snap, rect);
      updateAxisLock(grab, snap, rect);
      updateBadge(grab, snap, rect);

      // Live move: the base map group (image + annotations) follows so the
      // grabbed point lands on the current target — with its revolution
      // family (plan axis root / sibling elevations, revolutionFollowers).
      if (grab && snap?.position) {
        const group = editor?.sceneManager?.imagesManager?.getGroup(
          grab.baseMapId
        );
        const deltaWorld = {
          x: snap.position.x - grab.startWorld.x,
          y: snap.position.y - grab.startWorld.y,
          z: snap.position.z - grab.startWorld.z,
        };
        if (group) {
          group.position.set(
            grab.groupStartPosition.x + deltaWorld.x,
            grab.groupStartPosition.y + deltaWorld.y,
            grab.groupStartPosition.z + deltaWorld.z
          );
        }
        poseRevolutionFollowers(grab.followers, deltaWorld);
      }
      editor.renderScene?.();
    }

    function onPointerMove(e) {
      lastPointer = { clientX: e.clientX, clientY: e.clientY };
      lastShiftKey = e.shiftKey;
      update({ clientX: e.clientX, clientY: e.clientY, shiftKey: e.shiftKey });
    }

    // Shift pressed / released with a still mouse: lock / unlock at once.
    function onShiftChange(e) {
      if (e.key !== "Shift" || e.repeat || !lastPointer) return;
      lastShiftKey = e.type === "keydown";
      if (!getMoveGrab()) return;
      update({ ...lastPointer, shiftKey: lastShiftKey });
    }

    function onPointerLeave() {
      lastPointer = null;
      setLastMoveSnap(null);
      if (snapCircleRef.current) snapCircleRef.current.style.display = "none";
      if (crossARef.current) crossARef.current.style.display = "none";
      if (crossBRef.current) crossBRef.current.style.display = "none";
      if (axisLineRef.current) axisLineRef.current.style.display = "none";
      badgeRef.current?.hide?.();
      editor.renderScene?.();
    }

    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("keydown", onShiftChange);
    window.addEventListener("keyup", onShiftChange);
    return () => {
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onShiftChange);
      window.removeEventListener("keyup", onShiftChange);
      setLastMoveSnap(null);
    };
  }, [active, findNearestSnap]);

  if (!active) return null;
  return (
    <>
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
        <line
          ref={axisLineRef}
          strokeWidth="1.5"
          strokeDasharray="6 4"
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
      <DrawingLengthBadge ref={badgeRef} />
    </>
  );
}
