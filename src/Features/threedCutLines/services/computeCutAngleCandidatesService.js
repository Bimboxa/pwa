import getUserAxesWorldDirections from "Features/threedEditor/utils/getUserAxesWorldDirections";

import collectSceneTriangles from "../js/collectSceneTriangles";
import computeCutAngleLines from "../utils/computeCutAngleLines";
import { parseCutPlaneBuffer } from "../utils/cutPlaneBuffer";
import getCutAngleStations, {
  resolveCutAngleDeg,
} from "../utils/getCutAngleStations";
import computeCutPlaneCandidatesService from "./computeCutPlaneCandidatesService";
import { getCutPlanePending, setCutPlanePending } from "./cutPlaneStore";

export const CUT_ANGLE_KIND = "ANGLE";

// Unit world direction of the rotation axis: the user axis (repère) picked
// in the helper, Z by default.
export function getCutAngleAxisWorld(state) {
  const { angleAxis } = state.threedEditor.cutPlaneDraw;
  const axes = getUserAxesWorldDirections(
    state.threedEditor.axesSettings?.yawDeg
  );
  const dir = (axes.find((a) => a.key === angleAxis) ?? axes[2]).dir;
  return { x: dir.x, y: dir.y, z: dir.z };
}

// Angle and half-planes of the pivot P1, the reference P2, the angle point
// (third click or cursor) and the typed buffer `<angle°>[*N | /N]`: a typed
// angle keeps the side of the angle point. { angleDeg, stations } —
// angleDeg null / no station while the points do not define an angle.
export function getCutAngleStationsForBuffer({ p1, p2, p3, axis, buffer }) {
  const { lengthM: typedDeg, count, mode } = parseCutPlaneBuffer(buffer);
  const angleDeg = resolveCutAngleDeg({
    origin: p1,
    axis,
    refPoint: p2,
    cursor: p3,
    typedDeg,
  });
  const stations = getCutAngleStations({
    origin: p1,
    axis,
    refPoint: p2,
    angleDeg,
    count,
    mode,
  });
  return { angleDeg: stations.length ? angleDeg : null, stations };
}

// « Coupe par angle »: candidate cut lines of the half-planes turning
// around the axis through P1 — the section of the visible annotation solids
// by every half-plane — published to cutPlaneStore (CutPlaneOverlayThreed
// blinks them, Space / Enter creates them). The points default to the
// pending ones (recompute after an option change). Returns the candidates.
export default function computeCutAngleCandidatesService({
  editor,
  state,
  p1 = getCutPlanePending()?.p1,
  p2 = getCutPlanePending()?.p2,
  p3 = getCutPlanePending()?.p3,
}) {
  if (!editor?.sceneManager || !p1 || !p2 || !p3) return [];
  const { buffer, nearestOnly } = state.threedEditor.cutPlaneDraw;
  const axis = getCutAngleAxisWorld(state);
  const { angleDeg, stations } = getCutAngleStationsForBuffer({
    p1,
    p2,
    p3,
    axis,
    buffer,
  });
  const candidates = computeCutAngleLines({
    stations,
    triangles: collectSceneTriangles(editor.sceneManager),
    nearestOnly,
  });
  setCutPlanePending({
    kind: CUT_ANGLE_KIND,
    p1,
    p2,
    p3,
    axis,
    angleDeg,
    stations,
    candidates,
  });
  return candidates;
}

// Recomputes the pending candidates of either cut plane command after an
// option change (typed buffer, « contour le plus proche », rotation axis).
export function recomputeCutPlanePendingService({ editor, state }) {
  const pending = getCutPlanePending();
  if (!pending) return [];
  return pending.kind === CUT_ANGLE_KIND
    ? computeCutAngleCandidatesService({ editor, state })
    : computeCutPlaneCandidatesService({ editor, state });
}
