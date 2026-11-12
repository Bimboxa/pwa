import { useEffect, useRef } from "react";

import { useSelector, useStore } from "react-redux";
import { Group, Vector3 } from "three";

import DrawingLengthBadge from "Features/mapEditorGeneric/components/DrawingLengthBadge";
import buildDrawingVertexMarkers from "Features/threedDrawing/utils/buildDrawingVertexMarkers";
import {
  buildConnectedPolyline,
  disposeObject,
  getCanvasResolution,
  makeLineMaterial,
} from "Features/threedDrawing/utils/drawingOverlayLines";
import { getLastSnap } from "Features/threedDrawing/services/lastSnapStore";
import {
  isCutAngleDraft,
  selectIsCutPlaneDrawActive,
} from "Features/threedDrawing/utils/templateFaceDrawSelectors";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import {
  getCutAngleAxisWorld,
  getCutAngleStationsForBuffer,
  recomputeCutPlanePendingService,
} from "../services/computeCutAngleCandidatesService";
import { getCutPlaneStationsForBuffer } from "../services/computeCutPlaneCandidatesService";
import {
  clearCutPlanePending,
  getCutAngleRef,
  getCutPlanePending,
  setCutAngleRef,
} from "../services/cutPlaneStore";
import {
  formatCutPlaneCount,
  getCutPlaneValuePart,
} from "../utils/cutPlaneBuffer";
import {
  getCutAngleRadial,
  rotateCutAngleDir,
} from "../utils/getCutAngleStations";

// Fluo green of the candidates (theme.palette.editor.selected).
const COLOR_CANDIDATE = 0x39ff14;
// « Coupe par angle » guides: smallest ray length (m), the arc sits at this
// share of the reference radius and is sampled every ARC_STEP_DEG.
const MIN_GUIDE_RADIUS_M = 0.5;
const ARC_RADIUS_RATIO = 0.55;
const ARC_STEP_DEG = 5;
const CANDIDATE_LINEWIDTH = 4;
const AXIS_LINEWIDTH = 2;
const STATION_MARKER_PX = 7;
const BLINK_PERIOD_MS = 800;

const key3 = (p) => `${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}`;

// 3D overlay of the « Plan de coupe » command (DRAW_CUT_PLANE):
//   - once P1 is placed, small dots mark where the cut planes cross the
//     provisional axis (beyond P2 for `*N`, between P1 and P2 for `/N`),
//     following the snapped cursor;
//   - after the second click, the candidate cut lines (cutPlaneStore) blink
//     in fluo green until Space / Enter creates them.
// « Coupe par angle » (DRAW_CUT_ANGLE, a cut plane draft of kind "ANGLE")
// shares the overlay: instead of the axis dots it shows the rotation axis
// through the pivot, the reference ray, one ray per half-plane, the arc of
// the angle and its badge; its candidates blink the same way.
// The rubber band, snap markers and length badge are DrawingOverlayThreed's.
// The scene renders on demand: the blink owns a rAF loop while candidates
// are shown.
export default function CutPlaneOverlayThreed() {
  const store = useStore();

  // data

  const active = useSelector(
    (s) => s.threedEditor.drawingMode.active && selectIsCutPlaneDrawActive(s)
  );
  const nearestOnly = useSelector(
    (s) => s.threedEditor.cutPlaneDraw.nearestOnly
  );
  const buffer = useSelector((s) => s.threedEditor.cutPlaneDraw.buffer);
  const angleAxis = useSelector((s) => s.threedEditor.cutPlaneDraw.angleAxis);

  // Angle badge of « Coupe par angle » (same pill as the « Tourner » tool).
  const badgeRef = useRef(null);

  // effects

  // An option changed while candidates are shown: recompute them (the
  // keyboard path does it itself; this covers the helper's fields).
  useEffect(() => {
    if (!active || !getCutPlanePending()) return;
    recomputeCutPlanePendingService({
      editor: getActiveThreedEditor(),
      state: store.getState(),
    });
  }, [active, nearestOnly, buffer, angleAxis, store]);

  useEffect(() => {
    if (!active) return undefined;
    const editor = getActiveThreedEditor();
    const sceneManager = editor?.sceneManager;
    const scene = sceneManager?.scene;
    if (!scene) return undefined;

    const root = new Group();
    root.name = "CutPlaneOverlayThreed";
    root.userData.isDecor = true;
    scene.add(root);

    let rafId = null;
    let objects = [];
    let candidateMaterial = null;
    let signature = null;
    let shownPending = null;
    // « Coupe par angle »: { position, angleDeg } of the angle badge.
    let angleBadge = null;
    const projectScratch = new Vector3();

    function clearObjects() {
      for (const obj of objects) {
        root.remove(obj);
        disposeObject(obj);
      }
      objects = [];
      candidateMaterial = null;
    }

    function addObject(obj) {
      if (!obj) return;
      obj.raycast = () => {};
      obj.frustumCulled = false;
      obj.renderOrder = 1003;
      root.add(obj);
      objects.push(obj);
    }

    function addAxis(p1, stations, resolution) {
      const last = stations[stations.length - 1]?.point;
      if (last) {
        addObject(
          buildConnectedPolyline(
            [p1, last],
            makeLineMaterial({
              color: COLOR_CANDIDATE,
              linewidth: AXIS_LINEWIDTH,
              dashed: true,
              resolution,
              dashSize: 0.08,
            })
          )
        );
      }
      addObject(
        buildDrawingVertexMarkers(
          stations.map((s) => s.point),
          COLOR_CANDIDATE,
          { size: STATION_MARKER_PX }
        )
      );
    }

    function addLine(points, options) {
      addObject(
        buildConnectedPolyline(
          points,
          makeLineMaterial({ color: COLOR_CANDIDATE, ...options })
        )
      );
    }

    // « Coupe par angle » guides: the rotation axis through the pivot, the
    // reference ray (0°), one ray per half-plane and the arc of the angle.
    // Returns the world point the angle badge sits on (null: no angle yet).
    function addAngleGuides({ p1, p2, p3, axis, typedBuffer, resolution }) {
      const cursorRadial = p3
        ? getCutAngleRadial({ origin: p1, axis, point: p3 })
        : null;
      const refRadial = p2
        ? getCutAngleRadial({ origin: p1, axis, point: p2 })
        : null;
      const radius = Math.max(
        Math.hypot(refRadial?.x ?? 0, refRadial?.y ?? 0, refRadial?.z ?? 0),
        p2
          ? 0
          : Math.hypot(
              cursorRadial?.x ?? 0,
              cursorRadial?.y ?? 0,
              cursorRadial?.z ?? 0
            ),
        MIN_GUIDE_RADIUS_M
      );
      const along = (dir, k) => ({
        x: p1.x + dir.x * k,
        y: p1.y + dir.y * k,
        z: p1.z + dir.z * k,
      });
      addLine([along(axis, -radius), along(axis, radius)], {
        linewidth: AXIS_LINEWIDTH,
        dashed: true,
        resolution,
        dashSize: 0.08,
      });
      if (!p2 || !refRadial) return null;
      const refLength = Math.hypot(refRadial.x, refRadial.y, refRadial.z);
      if (refLength < 1e-9) return null;
      const refDir = {
        x: refRadial.x / refLength,
        y: refRadial.y / refLength,
        z: refRadial.z / refLength,
      };
      addLine([p1, along(refDir, radius)], {
        linewidth: AXIS_LINEWIDTH,
        resolution,
      });
      if (!p3) return null;
      const { angleDeg, stations } = getCutAngleStationsForBuffer({
        p1,
        p2,
        p3,
        axis,
        buffer: typedBuffer,
      });
      if (angleDeg === null) return null;
      for (const station of stations) {
        addLine([p1, along(station.dir, radius)], {
          linewidth: AXIS_LINEWIDTH,
          dashed: true,
          resolution,
          dashSize: 0.08,
        });
      }
      // Arc from the reference to the last half-plane, capped to one turn.
      const lastDeg = stations[stations.length - 1].angleDeg;
      const sweep = Math.sign(lastDeg) * Math.min(Math.abs(lastDeg), 360);
      const steps = Math.max(2, Math.ceil(Math.abs(sweep) / ARC_STEP_DEG));
      const arc = [];
      for (let i = 0; i <= steps; i++) {
        const dir = rotateCutAngleDir({
          axis,
          refDir,
          angleDeg: (sweep * i) / steps,
        });
        arc.push(along(dir, radius * ARC_RADIUS_RATIO));
      }
      addLine(arc, { linewidth: AXIS_LINEWIDTH, resolution });
      const badgeDir = rotateCutAngleDir({
        axis,
        refDir,
        angleDeg: angleDeg / 2,
      });
      return {
        position: along(badgeDir, radius * ARC_RADIUS_RATIO),
        angleDeg,
      };
    }

    function updateAngleBadge(typedBuffer) {
      const badge = badgeRef.current;
      if (!badge) return;
      const dom = sceneManager.renderer?.domElement;
      const camera = sceneManager.camera;
      if (!angleBadge || !dom || !camera) {
        badge.hide();
        return;
      }
      const { position, angleDeg } = angleBadge;
      const projected = projectScratch
        .set(position.x, position.y, position.z)
        .project(camera);
      if (projected.z < -1 || projected.z > 1) {
        badge.hide();
        return;
      }
      const typed = getCutPlaneValuePart(typedBuffer);
      const count = formatCutPlaneCount(typedBuffer);
      badge.update({
        x: ((projected.x + 1) / 2) * dom.clientWidth,
        y: ((1 - projected.y) / 2) * dom.clientHeight,
        text: `${typed || Math.abs(angleDeg).toFixed(1)}°${count ? ` ${count}` : ""}`,
        locked: typed !== "",
        anchor: "center",
      });
    }

    function rebuild(p1, pending, snapPosition, typedBuffer, angle) {
      clearObjects();
      angleBadge = null;
      const resolution = getCanvasResolution(editor);
      if (angle) {
        const anchor = pending?.p1 ?? p1;
        if (anchor) {
          angleBadge = addAngleGuides({
            p1: anchor,
            p2: pending?.p2 ?? angle.ref,
            p3: pending?.p3 ?? snapPosition,
            axis: angle.axis,
            typedBuffer,
            resolution,
          });
        }
        if (pending) {
          candidateMaterial = makeLineMaterial({
            color: COLOR_CANDIDATE,
            linewidth: CANDIDATE_LINEWIDTH,
            resolution,
          });
          for (const line of pending.candidates) {
            addObject(buildConnectedPolyline(line.points, candidateMaterial));
          }
        }
        return;
      }
      if (pending) {
        addAxis(pending.p1, pending.stations ?? [], resolution);
        candidateMaterial = makeLineMaterial({
          color: COLOR_CANDIDATE,
          linewidth: CANDIDATE_LINEWIDTH,
          resolution,
        });
        for (const line of pending.candidates) {
          // One material for every candidate; disposed once (disposeObject
          // tolerates the repeats).
          addObject(buildConnectedPolyline(line.points, candidateMaterial));
        }
        return;
      }
      if (!p1 || !snapPosition) return;
      const stations = getCutPlaneStationsForBuffer(
        p1,
        snapPosition,
        typedBuffer
      );
      // A single plane sits on the snapped cursor itself: nothing to add.
      if (stations.length > 1) addAxis(p1, stations, resolution);
    }

    function tick(now) {
      const s = store.getState();
      const p1 = s.threedEditor.drawingMode.inProgressPolyline[0] ?? null;
      const typedBuffer = s.threedEditor.cutPlaneDraw.buffer;
      const pending = getCutPlanePending();
      const snapPosition = getLastSnap()?.position ?? null;
      const angle = isCutAngleDraft(s)
        ? { axis: getCutAngleAxisWorld(s), ref: p1 ? getCutAngleRef() : null }
        : null;

      // Candidates: a new store object per computation. Preview: the axis
      // and the typed buffer (plus the reference and the rotation axis of
      // « Coupe par angle »).
      let next = pending
        ? "PENDING"
        : p1 && snapPosition
          ? `${key3(p1)}|${key3(snapPosition)}|${typedBuffer}`
          : "";
      if (angle) {
        next += `|ANGLE|${key3(angle.axis)}|${angle.ref ? key3(angle.ref) : ""}`;
      }
      const changed = next !== signature || pending !== shownPending;
      if (changed) {
        signature = next;
        shownPending = pending;
        rebuild(p1, pending, snapPosition, typedBuffer, angle);
      }
      // The badge follows the camera: placed every frame.
      updateAngleBadge(typedBuffer);
      if (candidateMaterial) {
        const phase =
          0.5 + 0.5 * Math.sin((2 * Math.PI * now) / BLINK_PERIOD_MS);
        candidateMaterial.opacity = 0.25 + 0.75 * phase;
        sceneManager.renderScene?.();
      } else if (changed) {
        sceneManager.renderScene?.();
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      clearObjects();
      scene.remove(root);
      clearCutPlanePending();
      setCutAngleRef(null);
      badgeRef.current?.hide();
      sceneManager.renderScene?.();
    };
  }, [active, store]);

  // render

  return <DrawingLengthBadge ref={badgeRef} />;
}
