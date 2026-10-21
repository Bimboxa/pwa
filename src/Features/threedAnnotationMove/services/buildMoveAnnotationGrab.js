import { buildIndex } from "Features/threedDrawing/hooks/useVertexSnap";
import {
  collectRevolutionFollowers,
  getRevolutionFollowerSubtrees,
} from "Features/threedEditor/js/utilsAnnotationsManager/revolutionFollowers";

import { setMoveAnnotationGrab } from "./moveAnnotationSessionStore";

const ZERO_DELTA = { x: 0, y: 0, z: 0 };

// Builds and installs the grab of the 3D « Déplacer » tool
// (moveAnnotationSessionStore) for `annotationIds` on base map `group`,
// grabbed at `snapPosition` (world): the carried roots' start poses, the
// grabbed point in the group's LOCAL metre frame, a target-only snap index
// (the carried roots excluded) and the typed buffer. Shared by the grab
// click (useMoveAnnotationPointerHandlers) and the re-grab after a repeated
// drop (rearmMoveAnnotationAfterCommit).
// Returns the carried ids actually grabbed (built in 3D), [] when none.
export default function buildMoveAnnotationGrab({
  editor,
  annotationIds,
  baseMapId,
  group,
  snapPosition,
  isRevolutionAxis = false,
  copyBuffer = "",
  annotations,
}) {
  const annotationsObjectsMap =
    editor?.sceneManager?.annotationsManager?.annotationsObjectsMap ?? {};
  const roots = [];
  const rootStartPoses = new Map();
  const carriedIds = [];
  for (const id of annotationIds) {
    const root = annotationsObjectsMap[id];
    if (!root) {
      // Not built in 3D (async load) — can't preview it, leave it out.
      console.warn("[threedAnnotationMove] no 3D object for", id);
      continue;
    }
    roots.push(root);
    rootStartPoses.set(id, {
      position: root.position.clone(),
      rotZ: root.rotation.z,
    });
    carriedIds.push(id);
  }
  if (!carriedIds.length || !group) return [];

  group.updateWorldMatrix(true, false);
  const startLocal = group.worldToLocal(snapPosition.clone());

  // A revolution axis drags the vertical base maps it poses along (live
  // follow — revolutionFollowers); they are not drop targets either.
  const followers = isRevolutionAxis
    ? collectRevolutionFollowers({
        editor,
        annotations,
        axisId: carriedIds[0],
      })
    : null;

  // Fresh target-only snap index, excluding every carried annotation root:
  // the carried geometry must never screen the drop targets, and a
  // grab-time rebuild guarantees up-to-date world positions.
  const { verts: targetVerts, adjacency: targetAdjacency } = buildIndex(
    editor?.sceneManager?.scene,
    { excludeSubtrees: [...roots, ...getRevolutionFollowerSubtrees(followers)] }
  );

  setMoveAnnotationGrab({
    baseMapId,
    annotationIds: carriedIds,
    startWorld: snapPosition.clone(),
    startLocal: { x: startLocal.x, y: startLocal.y, z: startLocal.z },
    isRevolutionAxis,
    followers,
    rootStartPoses,
    targetVerts,
    targetAdjacency,
    copyBuffer,
    ghosts: [],
    // Resolved snapshot of the carried annotations (copy ghosts).
    carriedAnnotations: (annotations ?? []).filter((a) =>
      carriedIds.includes(a.id)
    ),
    lastDelta: ZERO_DELTA,
  });
  return carriedIds;
}

// Rebuilds the grab's target-only snap index (new copies written and built:
// they become drop targets) — the carried roots stay excluded.
export function refreshMoveAnnotationGrabTargets(editor, grab) {
  if (!grab) return;
  const annotationsObjectsMap =
    editor?.sceneManager?.annotationsManager?.annotationsObjectsMap ?? {};
  const roots = grab.annotationIds
    .map((id) => annotationsObjectsMap[id])
    .filter(Boolean);
  const { verts, adjacency } = buildIndex(editor?.sceneManager?.scene, {
    excludeSubtrees: [
      ...roots,
      ...getRevolutionFollowerSubtrees(grab.followers),
    ],
  });
  grab.targetVerts = verts;
  grab.targetAdjacency = adjacency;
}
