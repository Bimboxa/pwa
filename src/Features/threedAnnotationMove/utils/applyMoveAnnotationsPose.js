import { scaleDeltaToLength } from "Features/annotationTransform/utils/copyBuffer";
import {
  localDeltaToWorld,
  poseRevolutionFollowers,
} from "Features/threedEditor/js/utilsAnnotationsManager/revolutionFollowers";

// Local (base map metre frame) delta that brings the grabbed point onto
// `targetWorld`. The roots are children of the base map group with their
// geometry baked in the group's LOCAL metre frame, so a move is a plain
// position offset in that frame.
// options.includeZ: when true (a real snap — VERTEX / EDGE / PLANE / AXIS),
// the vertical component (plane normal) follows too, so the grabbed point
// lands EXACTLY on the target, altitude included — persisted as an offsetZ
// delta at commit. When false (free cursor), the vertical component is
// dropped so the annotations keep their altitude while sliding in the plane.
// options.lengthM: typed distance — the delta is rescaled to that length
// (the target only gives the direction).
// Returns {x, y, z}, or null when the group is gone.
export function computeMoveDeltaLocal(editor, grab, targetWorld, options = {}) {
  const group = editor?.sceneManager?.imagesManager?.getGroup(grab.baseMapId);
  if (!group) return null;
  group.updateWorldMatrix(true, false);
  const local = group.worldToLocal(targetWorld.clone());
  const delta = {
    x: local.x - grab.startLocal.x,
    y: local.y - grab.startLocal.y,
    z: options.includeZ ? local.z - grab.startLocal.z : 0,
  };
  return options.lengthM > 0
    ? scaleDeltaToLength(delta, options.lengthM)
    : delta;
}

// Poses the carried annotation roots at their grab-time pose + `delta`
// (local metres) — and, for a revolution axis, the vertical base maps it
// poses (same delta, in world metres). Does not render.
export function poseCarriedAnnotations(editor, grab, delta) {
  const annotationsObjectsMap =
    editor?.sceneManager?.annotationsManager?.annotationsObjectsMap ?? {};
  for (const id of grab.annotationIds) {
    const root = annotationsObjectsMap[id];
    const start = grab.rootStartPoses.get(id);
    if (!root || !start) continue;
    root.position.set(
      start.position.x + delta.x,
      start.position.y + delta.y,
      start.position.z + delta.z
    );
  }
  if (grab.followers) {
    const group = editor?.sceneManager?.imagesManager?.getGroup(grab.baseMapId);
    poseRevolutionFollowers(grab.followers, localDeltaToWorld(group, delta));
  }
}

// Poses the carried annotation roots so the grabbed point lands on
// `targetWorld` (see computeMoveDeltaLocal for `options`), renders, and
// returns the local delta (reused by the drop handler for the commit) — or
// null when the group is gone.
export default function applyMoveAnnotationsPose(
  editor,
  grab,
  targetWorld,
  options = {}
) {
  const delta = computeMoveDeltaLocal(editor, grab, targetWorld, options);
  if (!delta) return null;
  poseCarriedAnnotations(editor, grab, delta);
  editor.renderScene?.();
  return delta;
}
