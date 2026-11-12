import { setConstraintBuffer } from "Features/mapEditor/mapEditorSlice";
import { setCutPlaneBuffer } from "Features/threedEditor/threedEditorSlice";

import collectSceneTriangles from "../js/collectSceneTriangles";
import computeCutPlaneLines from "../utils/computeCutPlaneLines";
import {
  getCutPlaneValuePart,
  parseCutPlaneBuffer,
} from "../utils/cutPlaneBuffer";
import getCutPlaneStations from "../utils/getCutPlaneStations";
import { getCutPlanePending, setCutPlanePending } from "./cutPlaneStore";

// Axis end actually used: P2 as clicked, or — with a typed length — the
// point at that length from P1 along P1 → P2 (the previewed snap is already
// there; this keeps a length typed AFTER the second click in sync).
export function resolveCutPlaneAxisEnd(p1, p2, lengthM) {
  if (!p1 || !p2 || !(lengthM > 0)) return p2;
  const d = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };
  const len = Math.hypot(d.x, d.y, d.z);
  if (len < 1e-9) return p2;
  const k = lengthM / len;
  return { x: p1.x + d.x * k, y: p1.y + d.y * k, z: p1.z + d.z * k };
}

// Stations of the cut planes for the axis P1 → P2 and the typed buffer.
export function getCutPlaneStationsForBuffer(p1, p2, buffer) {
  const { lengthM, count, mode } = parseCutPlaneBuffer(buffer);
  return getCutPlaneStations({
    p1,
    p2: resolveCutPlaneAxisEnd(p1, p2, lengthM),
    count,
    mode,
  });
}

// « Plan de coupe »: candidate cut lines of the axis P1 → P2 — the section
// of the visible annotation solids by every cut plane — published to
// cutPlaneStore (CutPlaneOverlayThreed blinks them, Space / Enter creates
// them). `p1` / `p2` default to the pending ones (recompute after an option
// change). Returns the candidates.
export default function computeCutPlaneCandidatesService({
  editor,
  state,
  p1 = getCutPlanePending()?.p1,
  p2 = getCutPlanePending()?.p2,
}) {
  if (!editor?.sceneManager || !p1 || !p2) return [];
  const { buffer, nearestOnly } = state.threedEditor.cutPlaneDraw;
  const stations = getCutPlaneStationsForBuffer(p1, p2, buffer);
  const candidates = computeCutPlaneLines({
    stations,
    triangles: collectSceneTriangles(editor.sceneManager),
    nearestOnly,
  });
  setCutPlanePending({ p1, p2, stations, candidates });
  return candidates;
}

// Single entry of the typed buffer (keyboard + helper fields): its length
// part is mirrored in the drawing's constraint buffer, so the provisional
// point of the 3D drawing overlay is held at that length.
export function setCutPlaneBufferService(dispatch, buffer) {
  dispatch(setCutPlaneBuffer(buffer));
  dispatch(setConstraintBuffer(getCutPlaneValuePart(buffer)));
}
