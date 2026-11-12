import { useEffect } from "react";

import { useSelector, useStore } from "react-redux";
import { Group } from "three";

import buildDrawingVertexMarkers from "Features/threedDrawing/utils/buildDrawingVertexMarkers";
import {
  buildConnectedPolyline,
  disposeObject,
  getCanvasResolution,
  makeLineMaterial,
} from "Features/threedDrawing/utils/drawingOverlayLines";
import { getLastSnap } from "Features/threedDrawing/services/lastSnapStore";
import { selectIsCutPlaneDrawActive } from "Features/threedDrawing/utils/templateFaceDrawSelectors";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import computeCutPlaneCandidatesService, {
  getCutPlaneStationsForBuffer,
} from "../services/computeCutPlaneCandidatesService";
import {
  clearCutPlanePending,
  getCutPlanePending,
} from "../services/cutPlaneStore";

// Fluo green of the candidates (theme.palette.editor.selected).
const COLOR_CANDIDATE = 0x39ff14;
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

  // effects

  // An option changed while candidates are shown: recompute them (the
  // keyboard path does it itself; this covers the helper's fields).
  useEffect(() => {
    if (!active || !getCutPlanePending()) return;
    computeCutPlaneCandidatesService({
      editor: getActiveThreedEditor(),
      state: store.getState(),
    });
  }, [active, nearestOnly, buffer, store]);

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

    function rebuild(p1, pending, snapPosition, typedBuffer) {
      clearObjects();
      const resolution = getCanvasResolution(editor);
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

      // Candidates: a new store object per computation. Preview: the axis
      // and the typed buffer.
      const next = pending
        ? "PENDING"
        : p1 && snapPosition
          ? `${key3(p1)}|${key3(snapPosition)}|${typedBuffer}`
          : "";
      const changed = next !== signature || pending !== shownPending;
      if (changed) {
        signature = next;
        shownPending = pending;
        rebuild(p1, pending, snapPosition, typedBuffer);
      }
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
      sceneManager.renderScene?.();
    };
  }, [active, store]);

  // render

  return null;
}
