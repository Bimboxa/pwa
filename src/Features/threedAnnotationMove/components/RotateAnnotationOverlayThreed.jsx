import { useEffect, useRef } from "react";

import { useSelector } from "react-redux";
import { Plane, Quaternion, Raycaster, Vector2, Vector3 } from "three";

import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import useVertexSnap from "Features/threedDrawing/hooks/useVertexSnap";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import { AXIS_COLORS } from "Features/threedEditor/constants/axesDisplay";
import getUserAxesWorldDirections from "Features/threedEditor/utils/getUserAxesWorldDirections";
import computeSnapTarget from "Features/threedDrawing/utils/computeSnapTarget";
import buildUserAxesPlaneHit from "Features/threedDrawing/utils/buildUserAxesPlaneHit";

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
const COLOR_LOCK = "#ff1744";
const ALIGN_MARKER_FILL = "rgba(255, 23, 68, 0.15)";
const COLOR_PIVOT = "#e65100";
const COLOR_REF_LINE = "#9e9e9e";
const COLOR_CURRENT_LINE = "#e65100";

const SNAP_CIRCLE_RADIUS_PX = 6;
const SNAP_CIRCLE_STROKE_PX = 2;
const PIVOT_CIRCLE_RADIUS_PX = 4;
// Vertices the pivot cursor is aligned with (one marker per cross arm).
const ALIGN_MARKERS_COUNT = 2;
const ALIGN_LEADER_EPS_M = 5e-3;

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
// 1. pivot phase: the drawing cascade of a polyline's first point
//    (computeSnapTarget): a vertex (an annotation's: that annotation is
//    turned, with the implicit-selection rule), else an edge, else a point
//    of a base map plane — or of the 2D-selected base map's plane when the
//    cursor is off every plan — aligned with the existing vertices along
//    the plane's axes (markers + solid arms): the SELECTION is then turned
//    around it;
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
  // Free pivot fallback plane: the 2D-selected base map (read in the
  // pointer handler through a ref, no re-attach).
  const mainBaseMapId = useMainBaseMap()?.id ?? null;
  const mainBaseMapIdRef = useRef(mainBaseMapId);
  mainBaseMapIdRef.current = mainBaseMapId;
  // User axes of the gizmo frame: the alignment arms and their colours.
  const yawDeg = useSelector((s) => s.threedEditor.axesSettings.yawDeg);
  const yawDegRef = useRef(yawDeg);
  yawDegRef.current = yawDeg;

  const snapCircleRef = useRef(null);
  const pivotCircleRef = useRef(null);
  const refLineRef = useRef(null);
  const currentLineRef = useRef(null);
  const axisLineRef = useRef(null);
  const arcRef = useRef(null);
  const crossARef = useRef(null);
  const crossBRef = useRef(null);
  const alignMarkerRefs = useRef([]);
  const alignLeaderRefs = useRef([]);
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
      updateAlignMarkers(null, null);
      updateAngleLabel(null, null);
    }

    // Vertices the pivot cursor is aligned with: a marker on each, plus a
    // dashed leader down to its footprint in the plane when it is off it
    // (e.g. a wall-top vertex) — same helpers as the drawing overlay.
    function updateAlignMarkers(snap, rect) {
      const vertices = snap?.alignFrom ?? [];
      for (let i = 0; i < ALIGN_MARKERS_COUNT; i++) {
        const marker = alignMarkerRefs.current[i];
        const leader = alignLeaderRefs.current[i];
        const vertex = vertices[i];
        const at = vertex && rect ? toScreen(vertex.position, rect) : null;
        if (marker) {
          if (at) {
            marker.setAttribute("cx", at.sx);
            marker.setAttribute("cy", at.sy);
          }
          marker.style.display = at ? "block" : "none";
        }
        if (!leader) continue;
        const isOffPlane =
          at &&
          vertex.footprint &&
          vertex.position.distanceTo(vertex.footprint) > ALIGN_LEADER_EPS_M;
        const foot = isOffPlane ? toScreen(vertex.footprint, rect) : null;
        if (foot) {
          leader.setAttribute("x1", at.sx);
          leader.setAttribute("y1", at.sy);
          leader.setAttribute("x2", foot.sx);
          leader.setAttribute("y2", foot.sy);
        }
        leader.style.display = foot ? "block" : "none";
      }
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
        const planeHitTarget = intersectBaseMapPlane(editor, ndc, camera, {
          axes: getUserAxesWorldDirections(yawDegRef.current),
        });
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

    // Off every plan: the 2D-selected base map's plane, with the user axes
    // as cross arms (alignment helpers keep working there).
    function intersectMainBaseMapPlane(mNdc, userAxes) {
      const baseMapId = mainBaseMapIdRef.current;
      const group = baseMapId
        ? editor?.sceneManager?.imagesManager?.getGroup(baseMapId)
        : null;
      if (!group) return null;
      group.updateWorldMatrix(true, false);
      raycaster.setFromCamera(mNdc, camera);
      group.getWorldQuaternion(groupQuat);
      planeNormal.set(0, 0, 1).applyQuaternion(groupQuat);
      fallbackPlane.setFromNormalAndCoplanarPoint(
        planeNormal,
        group.getWorldPosition(new Vector3())
      );
      if (!raycaster.ray.intersectPlane(fallbackPlane, planeHit)) return null;
      return buildUserAxesPlaneHit(planeHit, planeNormal, userAxes, {
        baseMapId,
      });
    }

    // Pivot pick (phase 1): the first-point cascade of the drawing overlay
    // (computeSnapTarget) — vertex (global index, so an annotation vertex
    // still grabs its annotation), edge, base map plane under the cursor
    // (else the 2D-selected base map's plane), the plane hit aligned with
    // the existing vertices along the plane's axes (alignFrom markers,
    // locked arms).
    function computePivotSnap(canvasSize) {
      const userAxes = getUserAxesWorldDirections(yawDegRef.current);
      return computeSnapTarget({
        mouseNdc: ndc,
        camera,
        canvasSize,
        lastVertex: undefined,
        inProgressPolyline: [],
        findNearestVertex: (mNdc, cam, sz, options) =>
          findNearestSnap(mNdc, cam, sz, 12, options),
        findNearestEdge: (mNdc, cam, sz, options) =>
          findNearestEdgeSnap(
            getMeshAdjacency(),
            mNdc,
            cam,
            sz,
            undefined,
            options
          ),
        intersectPlane: (mNdc) =>
          intersectBaseMapPlane(editor, mNdc, camera, {
            preferredBaseMapId: mainBaseMapIdRef.current,
            axes: userAxes,
          }) ?? intersectMainBaseMapPlane(mNdc, userAxes),
        alignAdjacency: getMeshAdjacency(),
        axes: userAxes.map((a) => ({ key: a.key, dir: a.dir })),
      });
    }

    function colorForSnap(snap) {
      if (snap?.lockedAxes?.A || snap?.lockedAxes?.B) return COLOR_LOCK;
      return colorForKind(snap?.kind);
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

    // Cross helper of a plane hit: the two dashed lines through the point,
    // parallel to the plane's edges, ending on its borders. An arm running
    // through an aligned vertex (pivot phase) is drawn solid, in the colour
    // of the user axis it follows when known, else the lock colour.
    function updateCross(target, rect) {
      const show = Boolean(target?.axisA && target?.axisB);
      [
        [crossARef, target?.axisA, "A"],
        [crossBRef, target?.axisB, "B"],
      ].forEach(([ref, axis, key]) => {
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
        const locked = Boolean(target.lockedAxes?.[key]);
        const armAxis = locked ? target.axisKeys?.[key] : null;
        el.style.stroke = locked
          ? (AXIS_COLORS[armAxis] ?? COLOR_LOCK)
          : COLOR_CROSS;
        if (locked) el.removeAttribute("stroke-dasharray");
        else el.setAttribute("stroke-dasharray", "5 4");
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
          colorForSnap(snap)
        );
        updateCross(snap, rect);
        updateAlignMarkers(snap, rect);
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
        {Array.from({ length: ALIGN_MARKERS_COUNT }).map((_, i) => (
          <line
            key={`leader-${i}`}
            ref={(el) => (alignLeaderRefs.current[i] = el)}
            stroke={COLOR_LOCK}
            strokeWidth="1"
            strokeDasharray="5 4"
            style={{ display: "none" }}
          />
        ))}
        {Array.from({ length: ALIGN_MARKERS_COUNT }).map((_, i) => (
          <circle
            key={`marker-${i}`}
            ref={(el) => (alignMarkerRefs.current[i] = el)}
            r={SNAP_CIRCLE_RADIUS_PX}
            stroke={COLOR_LOCK}
            strokeWidth="1"
            fill={ALIGN_MARKER_FILL}
            style={{ display: "none" }}
          />
        ))}
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
