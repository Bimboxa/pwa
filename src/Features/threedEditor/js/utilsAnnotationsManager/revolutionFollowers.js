import { Quaternion, Vector3 } from "three";

import getRevolutionAxisFamilies, {
  getRevolutionAxisFamiliesOfBaseMap,
} from "Features/revolutionAxes/utils/getRevolutionAxisFamilies";

// Live follow of the objects tied to a revolution axis while the 3D move
// tools carry something: a REVOLUTION_AXIS poses the VERTICAL base maps
// hosting its placements (their plane contains the axis), so
//   - carrying the plan AXIS drags those vertical base map groups along,
//   - carrying a VERTICAL base map drags the plan axis root (a child of the
//     plan group, posed in the plan's LOCAL frame) and the sibling vertical
//     maps of the same axis along,
//   - carrying the horizontal PLAN drags the vertical maps of every axis it
//     hosts along (the axis roots are its children already).
// Translation only (the 3D « Déplacer » tools never rotate). The persisted
// side is unchanged: the drop commits write the DB and the regular
// resync / reverse sync + useApplyBaseMapTransformsIn3d re-pose everything at
// the exact DB pose — the followers are already there, so no visual jump.
// Only base maps LOADED in 3D (a group in ImagesManager) and axes BUILT in
// 3D can follow; the others are re-posed at commit as before.

const getGroup = (editor, baseMapId) =>
  editor?.sceneManager?.imagesManager?.getGroup?.(baseMapId) ?? null;

// { groups: [{ baseMapId, group, startPosition }],
//   roots:  [{ axisId, root, planGroup, startPosition }] }
export function collectRevolutionFollowers({
  editor,
  annotations,
  axisId = null,
  baseMapId = null,
} = {}) {
  const annotationsObjectsMap =
    editor?.sceneManager?.annotationsManager?.annotationsObjectsMap ?? {};
  const groupsById = new Map();
  const rootsById = new Map();

  const addGroup = (id) => {
    if (!id || id === baseMapId || groupsById.has(id)) return;
    const group = getGroup(editor, id);
    if (!group) return;
    groupsById.set(id, {
      baseMapId: id,
      group,
      startPosition: group.position.clone(),
    });
  };
  const addRoot = (family) => {
    if (!family.axisId || family.axisId === axisId) return;
    if (rootsById.has(family.axisId)) return;
    const root = annotationsObjectsMap[family.axisId];
    const planGroup = getGroup(editor, family.planBaseMapId);
    if (!root || !planGroup) return;
    rootsById.set(family.axisId, {
      axisId: family.axisId,
      root,
      planGroup,
      startPosition: root.position.clone(),
    });
  };

  if (axisId) {
    const family = getRevolutionAxisFamilies(annotations).get(axisId);
    family?.placementBaseMapIds.forEach(addGroup);
  } else if (baseMapId) {
    for (const { family, isPlacement } of getRevolutionAxisFamiliesOfBaseMap(
      annotations,
      baseMapId
    )) {
      // Plan carried: the axis root rides along as its child; placement
      // carried: the axis root follows in the plan's local frame.
      if (isPlacement) addRoot(family);
      family.placementBaseMapIds.forEach(addGroup);
    }
  }

  return {
    groups: Array.from(groupsById.values()),
    roots: Array.from(rootsById.values()),
  };
}

// The subtrees that must stay out of a target-only snap index (they move
// with the carried object).
export function getRevolutionFollowerSubtrees(followers) {
  return [
    ...(followers?.groups ?? []).map((f) => f.group),
    ...(followers?.roots ?? []).map((f) => f.root),
  ];
}

const q = new Quaternion();
const tmp = new Vector3();

// Poses every follower at its start pose + `deltaWorld` (Vector3-like
// {x, y, z}, world metres). Does not render.
export function poseRevolutionFollowers(followers, deltaWorld) {
  if (!followers || !deltaWorld) return;
  for (const f of followers.groups) {
    f.group.position.set(
      f.startPosition.x + deltaWorld.x,
      f.startPosition.y + deltaWorld.y,
      f.startPosition.z + deltaWorld.z
    );
  }
  for (const f of followers.roots) {
    // World delta → the plan group's local frame (rotation only: base map
    // groups are never scaled).
    f.planGroup.updateWorldMatrix(true, false);
    f.planGroup.getWorldQuaternion(q);
    tmp
      .set(deltaWorld.x, deltaWorld.y, deltaWorld.z)
      .applyQuaternion(q.invert());
    f.root.position.set(
      f.startPosition.x + tmp.x,
      f.startPosition.y + tmp.y,
      f.startPosition.z + tmp.z
    );
  }
}

// Back to the grab-time poses (Escape / mode exit).
export function restoreRevolutionFollowers(followers) {
  if (!followers) return;
  for (const f of followers.groups) f.group.position.copy(f.startPosition);
  for (const f of followers.roots) f.root.position.copy(f.startPosition);
}

// A LOCAL delta of `group` (base map metre frame) expressed in world metres.
export function localDeltaToWorld(group, deltaLocal) {
  if (!group || !deltaLocal) return { x: 0, y: 0, z: 0 };
  group.updateWorldMatrix(true, false);
  group.getWorldQuaternion(q);
  tmp.set(deltaLocal.x, deltaLocal.y, deltaLocal.z).applyQuaternion(q);
  return { x: tmp.x, y: tmp.y, z: tmp.z };
}
