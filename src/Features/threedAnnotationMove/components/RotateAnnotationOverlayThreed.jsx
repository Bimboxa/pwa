import { useEffect, useRef } from "react";

import { useSelector } from "react-redux";
import { Plane, Quaternion, Raycaster, Vector2, Vector3 } from "three";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import useVertexSnap from "Features/threedDrawing/hooks/useVertexSnap";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import DrawingLengthBadge from "Features/mapEditorGeneric/components/DrawingLengthBadge";

import findNearestEdgeSnap from "Features/threedDimensions/utils/findNearestEdgeSnap";
import { getMeshAdjacency } from "Features/threedDrawing/services/meshGraphStore";
import findNearestVertexInVerts from "Features/threedBaseMapMove/utils/findNearestVertexInVerts";
import intersectBaseMapPlane from "Features/threedBaseMapMove/utils/intersectBaseMapPlane";
import {
  formatAngleValueBuffer,
  formatRotateBadge,
  parseTypedAngleDeg,
} from "Features/annotationTransform/utils/copyBuffer";

import useAnnotationsOnlyVertexSnap from "../hooks/useAnnotationsOnlyVertexSnap";
import applyRotateAnnotationsPose from "../utils/applyRotateAnnotationsPose";
import { getGrabCopyCount } from "../services/moveCopyGhostsThreed";
import {
  setLastRotateAnnotationSnap,
  getRotateAnnotationGrab,
} from "../services/rotateAnnotationSessionStore";

const COLOR_VERTEX = "#ff2d8d";
const COLOR_EDGE = "#2e7d32";
const COLOR_PLANE = "#1565c0";
const COLOR_CROSS = "#90a4ae";
const COLOR_FREE = "#000000";
const COLOR_PIVOT = "#e65100";
const COLOR_REF_LINE = "#9e9e9e";
const COLOR_CURRENT_LINE = "#e65100";

const SNAP_CIRCLE_RADIUS_PX = 6;
const SNAP_CIRCLE_STROKE_PX = 2;
const PIVOT_CIRCLE_RADIUS_PX = 4;

// A bearing difference lands in (-2π, 2π): bring the angle back to
// (-π, π] so the readout stays between -180° and +180°.
function normalizeAngle(phi) {
  let a = phi;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

// Live overlay of the "Tourner" (rotate annotation) tool — mirrors
// RotateBaseMapOverlayThreed, but everything angular is measured in the base
// map group's LOCAL XY frame (bearing = atan2(dy_local, dx_local)): the
// rotation happens around the plane's normal (local +Z), so the same math
// serves HORIZONTAL and VERTICAL maps. CAD-style 3 clicks:
// 1. pivot phase: a vertex of an annotation (that annotation is turned, with
//    the implicit-selection rule), else — like a polyline being drawn — an
//    edge, a point of a base map plane (cross) or a free point on the
//    2D-selected base map's plane: the SELECTION is then turned around it;
// 2. reference phase: dashed helper line from the pivot to the cursor
//    (global snap — the reference axis usually anchors on a point of the
//    rotated annotation itself, which hasn't moved yet);
// 3. rotation phase: the carried annotation roots rotate live around the
//    pivot (or, with a typed `*N`, the copy ghosts — the originals stay);
//    targets snap on the target-only index, then a base map plane, with
//    the pivot's base-map-plane free fallback. The angle label carries the
//    copy count ("45.0° ×3").
export default function RotateAnnotationOverlayThreed() {
  const active = useSelector((s) => s.threedEditor.rotateAnnotationMode.active);

  const { findNearestSnap } = useVertexSnap({ active });
  const { findNearestSnap: findNearestAnnotationSnap } =
    useAnnotationsOnlyVertexSnap({ active });
  // Free pivot fallback plane: the 2D-selected base map (read in the
  // pointer handler through a ref, no re-attach).
  const mainBaseMapId = useMainBaseMap()?.id ?? null;
  const mainBaseMapIdRef = useRef(mainBaseMapId);
  mainBaseMapIdRef.current = mainBaseMapId;

  const snapCircleRef = useRef(null);
  const pivotCircleRef = useRef(null);
  const refLineRef = useRef(null);
  const currentLineRef = useRef(null);
  const axisLineRef = useRef(null);
  const arcRef = useRef(null);
  const crossARef = useRef(null);
  const crossBRef = useRef(null);
  // Angle badge: the same DrawingLengthBadge as the move tool and the 2D
  // tools (pill, padlock when the angle is typed).
  const badgeRef = useRef(null);

  // pointer-move: snap detection + helper lines + live rotation
  useEffect(() => {
    if (!active) return;
    const editor = getActiveThreedEditor();
    const dom = editor?.sceneManager?.renderer?.domElement;
    const camera = editor?.sceneManager?.camera;
    if (!dom || !camera) return;

    const ndc = new Vector2();
    const raycaster = new Raycaster();
    const fallbackPlane = new Plane();
    const planeHit = new Vector3();
    const groupQuat = new Quaternion();
    const planeNormal = new Vector3();

    function getGroup(grab) {
      const group = editor?.sceneManager?.imagesManager?.getGroup(
        grab.baseMapId
      );
      if (group) group.updateWorldMatrix(true, false);
      return group ?? null;
    }

    function toLocal(group, worldPos) {
      return group.worldToLocal(worldPos.clone());
    }

    function localPoint(group, x, y, z) {
      return group.localToWorld(new Vector3(x, y, z));
    }

    function toScreen(worldPos, rect) {
      const projected = worldPos.clone().project(camera);
      if (projected.z < -1 || projected.z > 1) return null;
      return {
        sx: ((projected.x + 1) / 2) * rect.width,
        sy: ((1 - projected.y) / 2) * rect.height,
      };
    }

    function updateCircle(circleRef, worldPos, rect, color) {
      const circle = circleRef.current;
      if (!circle) return null;
      const screen = worldPos ? toScreen(worldPos, rect) : null;
      if (!screen) {
        circle.style.display = "none";
        return null;
      }
      circle.setAttribute("cx", screen.sx);
      circle.setAttribute("cy", screen.sy);
      circle.style.stroke = color;
      circle.style.display = "block";
      return screen;
    }

    function updateLine(lineRef, fromScreen, toScreen_) {
      const line = lineRef.current;
      if (!line) return;
      if (!fromScreen || !toScreen_) {
        line.style.display = "none";
        return;
      }
      line.setAttribute("x1", fromScreen.sx);
      line.setAttribute("y1", fromScreen.sy);
      line.setAttribute("x2", toScreen_.sx);
      line.setAttribute("y2", toScreen_.sy);
      line.style.display = "block";
    }

    function updateAngleLabel(phi, screen, grab = null) {
      const badge = badgeRef.current;
      if (!badge) return;
      if (phi == null || !screen) {
        badge.hide();
        return;
      }
      // A typed angle shows the raw buffer from its first character ("-"),
      // locked, so the constraint mode is visible at once.
      const typed = formatAngleValueBuffer(grab?.angleBuffer ?? "");
      badge.update({
        x: screen.sx,
        y: screen.sy,
        text: formatRotateBadge({
          angleLabel: typed
            ? `${typed}°`
            : `${((phi * 180) / Math.PI).toFixed(1)}°`,
          count: getGrabCopyCount(grab),
        }),
        locked: typed !== "",
      });
    }

    function hideAll() {
      [
        snapCircleRef,
        pivotCircleRef,
        refLineRef,
        currentLineRef,
        axisLineRef,
        arcRef,
        crossARef,
        crossBRef,
      ].forEach((r) => {
        if (r.current) r.current.style.display = "none";
      });
      updateAngleLabel(null, null);
    }

    // World point at `bearing` and `radius` from the pivot, in the base map
    // plane (LOCAL XY frame).
    function pointAtBearing(group, grab, bearing, radius) {
      const p = grab.pivotLocal;
      return localPoint(
        group,
        p.x + radius * Math.cos(bearing),
        p.y + radius * Math.sin(bearing),
        p.z
      );
    }

    // Small dashed line through the pivot along the plane normal (local Z)
    // = the rotation axis.
    function updateAxisLine(group, grab, rect, radius) {
      const h = Math.min(Math.max(radius * 0.6, 0.3), 4);
      const p = grab.pivotLocal;
      const top = toScreen(localPoint(group, p.x, p.y, p.z + h), rect);
      const bottom = toScreen(
        localPoint(group, p.x, p.y, p.z - h * 0.25),
        rect
      );
      updateLine(axisLineRef, bottom, top);
    }

    // Protractor sector between the reference ray and the current angle.
    function updateArc(group, grab, rect, radius, phi) {
      const arc = arcRef.current;
      if (!arc) return;
      const pivotScreen = toScreen(grab.pivot, rect);
      if (!pivotScreen || phi == null || Math.abs(phi) < 1e-4) {
        arc.style.display = "none";
        return;
      }
      const r = radius * 0.55;
      const steps = Math.max(
        2,
        Math.ceil(Math.abs(phi) / ((5 * Math.PI) / 180))
      );
      const pts = [];
      for (let i = 0; i <= steps; i++) {
        const beta = grab.refBearing + (phi * i) / steps;
        const screen = toScreen(pointAtBearing(group, grab, beta, r), rect);
        if (!screen) {
          arc.style.display = "none";
          return;
        }
        pts.push(screen);
      }
      const d =
        `M ${pivotScreen.sx} ${pivotScreen.sy} ` +
        pts.map((p) => `L ${p.sx} ${p.sy}`).join(" ") +
        " Z";
      arc.setAttribute("d", d);
      arc.style.display = "block";
    }

    // Target point driving the reference / rotation phases. The reference
    // phase snaps on EVERYTHING (global index — the reference axis usually
    // anchors on a point of the rotated annotation, which hasn't moved yet);
    // the rotation phase snaps on the target-only index (the carried roots
    // move, their index entries are stale, and they would screen the
    // targets). Between the mesh snap and the free fallback, a direct hit on
    // a base map image plane (point + edge-parallel cross). Free fallback =
    // the pivot's base map plane (its normal is the rotation axis).
    function computeTarget(group, grab, canvasSize) {
      const rotating = grab.refBearing != null;
      let target;
      if (rotating) {
        target =
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
      } else {
        const vertexSnap = findNearestSnap(ndc, camera, canvasSize, 12);
        target = vertexSnap
          ? { position: vertexSnap.position, kind: "VERTEX" }
          : findNearestEdgeSnap(
              getMeshAdjacency(),
              ndc,
              camera,
              canvasSize,
              12
            );
      }
      if (!target) {
        const planeHitTarget = intersectBaseMapPlane(editor, ndc, camera);
        if (planeHitTarget) {
          target = {
            position: planeHitTarget.position,
            kind: "PLANE",
            baseMapId: planeHitTarget.baseMapId,
            axisA: planeHitTarget.axisA,
            axisB: planeHitTarget.axisB,
          };
        }
      }
      if (!target && group) {
        raycaster.setFromCamera(ndc, camera);
        group.getWorldQuaternion(groupQuat);
        planeNormal.set(0, 0, 1).applyQuaternion(groupQuat);
        fallbackPlane.setFromNormalAndCoplanarPoint(planeNormal, grab.pivot);
        if (raycaster.ray.intersectPlane(fallbackPlane, planeHit)) {
          target = { position: planeHit.clone(), kind: "FREE" };
        }
      }
      return target;
    }

    // Pivot pick (phase 1): annotation vertex, else edge, else a base map
    // plane hit, else a free point on the 2D-selected base map's plane.
    function computePivotSnap(canvasSize) {
      const vertexSnap = findNearestAnnotationSnap(ndc, camera, canvasSize, 12);
      if (vertexSnap) return vertexSnap;
      const edgeSnap = findNearestEdgeSnap(
        getMeshAdjacency(),
        ndc,
        camera,
        canvasSize,
        12
      );
      if (edgeSnap) return edgeSnap;
      const planeHitTarget = intersectBaseMapPlane(editor, ndc, camera, {
        preferredBaseMapId: mainBaseMapIdRef.current,
      });
      if (planeHitTarget) {
        return {
          position: planeHitTarget.position,
          kind: "PLANE",
          baseMapId: planeHitTarget.baseMapId,
          axisA: planeHitTarget.axisA,
          axisB: planeHitTarget.axisB,
        };
      }
      const group = mainBaseMapIdRef.current
        ? editor?.sceneManager?.imagesManager?.getGroup(
            mainBaseMapIdRef.current
          )
        : null;
      if (!group) return null;
      group.updateWorldMatrix(true, false);
      raycaster.setFromCamera(ndc, camera);
      group.getWorldQuaternion(groupQuat);
      planeNormal.set(0, 0, 1).applyQuaternion(groupQuat);
      fallbackPlane.setFromNormalAndCoplanarPoint(
        planeNormal,
        group.getWorldPosition(new Vector3())
      );
      if (raycaster.ray.intersectPlane(fallbackPlane, planeHit)) {
        return { position: planeHit.clone(), kind: "FREE" };
      }
      return null;
    }

    function colorForKind(kind) {
      return kind === "VERTEX"
        ? COLOR_VERTEX
        : kind === "EDGE"
          ? COLOR_EDGE
          : kind === "PLANE"
            ? COLOR_PLANE
            : COLOR_FREE;
    }

    // Cross helper of a PLANE hit: the two dashed lines through the point,
    // parallel to the plane's edges, ending on its borders.
    function updateCross(target, rect) {
      const show = target?.kind === "PLANE" && target.axisA && target.axisB;
      [
        [crossARef, target?.axisA],
        [crossBRef, target?.axisB],
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

      const grab = getRotateAnnotationGrab();

      // Phase 1 — pivot pick: an annotation vertex, or any point (edge,
      // base map plane, free) when the selection is what turns.
      if (!grab) {
        const snap = computePivotSnap(canvasSize);
        setLastRotateAnnotationSnap(snap);
        hideAll();
        updateCircle(
          snapCircleRef,
          snap?.position ?? null,
          rect,
          colorForKind(snap?.kind)
        );
        updateCross(snap, rect);
        editor.renderScene?.();
        return;
      }

      const group = getGroup(grab);
      if (!group) return;

      const pivotScreen = updateCircle(
        pivotCircleRef,
        grab.pivot,
        rect,
        COLOR_PIVOT
      );

      const target = computeTarget(group, grab, canvasSize);
      setLastRotateAnnotationSnap(target);
      const targetScreen = target
        ? updateCircle(
            snapCircleRef,
            target.position,
            rect,
            colorForKind(target.kind)
          )
        : null;
      updateCross(target, rect);

      const targetLocal = target ? toLocal(group, target.position) : null;

      // Phase 2 — reference axis pick: dashed helper from the pivot to the
      // cursor, no rotation yet.
      if (grab.refBearing == null) {
        const refRadius = targetLocal
          ? Math.hypot(
              targetLocal.x - grab.pivotLocal.x,
              targetLocal.y - grab.pivotLocal.y
            )
          : 1;
        updateAxisLine(group, grab, rect, Math.max(refRadius, 0.5));
        updateLine(refLineRef, pivotScreen, targetScreen);
        if (currentLineRef.current)
          currentLineRef.current.style.display = "none";
        if (arcRef.current) arcRef.current.style.display = "none";
        updateAngleLabel(null, null);
        editor.renderScene?.();
        return;
      }

      // Phase 3 — rotation: the angle opens between the fixed reference ray
      // and the pivot→cursor ray (LOCAL XY bearings). A parsable typed
      // buffer (degrees) wins over the mouse.
      const refLocal = grab.refPoint ? toLocal(group, grab.refPoint) : null;
      const refRadius = refLocal
        ? Math.max(
            Math.hypot(
              refLocal.x - grab.pivotLocal.x,
              refLocal.y - grab.pivotLocal.y
            ),
            0.2
          )
        : 1;
      const refScreen = grab.refPoint ? toScreen(grab.refPoint, rect) : null;
      updateAxisLine(group, grab, rect, refRadius);
      updateLine(refLineRef, pivotScreen, refScreen);

      const typedDeg = parseTypedAngleDeg(grab.angleBuffer);
      const typedPhi = typedDeg == null ? null : (typedDeg * Math.PI) / 180;
      if (typedPhi != null) {
        applyRotateAnnotationsPose(editor, grab, typedPhi);
        const endScreen = toScreen(
          pointAtBearing(group, grab, grab.refBearing + typedPhi, refRadius),
          rect
        );
        updateLine(currentLineRef, pivotScreen, endScreen);
        if (snapCircleRef.current) snapCircleRef.current.style.display = "none";
        if (crossARef.current) crossARef.current.style.display = "none";
        if (crossBRef.current) crossBRef.current.style.display = "none";
        updateArc(group, grab, rect, refRadius, typedPhi);
        updateAngleLabel(typedPhi, endScreen, grab);
        editor.renderScene?.();
        return;
      }

      if (targetLocal) {
        const dx = targetLocal.x - grab.pivotLocal.x;
        const dy = targetLocal.y - grab.pivotLocal.y;
        // Degenerate cursor on the pivot: keep the current angle.
        if (Math.hypot(dx, dy) > 1e-6) {
          applyRotateAnnotationsPose(
            editor,
            grab,
            normalizeAngle(Math.atan2(dy, dx) - grab.refBearing)
          );
        }
      }

      updateLine(currentLineRef, pivotScreen, targetScreen);
      updateArc(group, grab, rect, refRadius, grab.currentPhi);
      updateAngleLabel(grab.currentPhi, targetScreen, grab);
      editor.renderScene?.();
    }

    function onPointerLeave() {
      setLastRotateAnnotationSnap(null);
      hideAll();
      editor.renderScene?.();
    }

    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerleave", onPointerLeave);
    return () => {
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerleave", onPointerLeave);
      setLastRotateAnnotationSnap(null);
    };
  }, [active, findNearestSnap, findNearestAnnotationSnap]);

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
        <path
          ref={arcRef}
          fill="rgba(230, 81, 0, 0.15)"
          stroke={COLOR_CURRENT_LINE}
          strokeWidth="1"
          style={{ display: "none" }}
        />
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
          stroke={COLOR_PIVOT}
          strokeWidth="1.5"
          strokeDasharray="4 3"
          style={{ display: "none" }}
        />
        <line
          ref={refLineRef}
          stroke={COLOR_REF_LINE}
          strokeWidth="2"
          strokeDasharray="6 4"
          style={{ display: "none" }}
        />
        <line
          ref={currentLineRef}
          stroke={COLOR_CURRENT_LINE}
          strokeWidth="2"
          strokeDasharray="6 4"
          style={{ display: "none" }}
        />
        <circle
          ref={pivotCircleRef}
          r={PIVOT_CIRCLE_RADIUS_PX}
          strokeWidth={SNAP_CIRCLE_STROKE_PX}
          fill={COLOR_PIVOT}
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
