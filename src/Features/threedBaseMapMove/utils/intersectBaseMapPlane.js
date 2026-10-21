import { Matrix4, Raycaster, Vector3 } from "three";

import { getUserAxesInPlane } from "../../threedDrawing/utils/buildUserAxesPlaneHit.js";

// Raycast the pointer against the base map image planes (userData.isBasemap)
// and return the closest hit with the cross-helper geometry: the two lines
// through the hit point, clipped to the image rectangle — so they always END
// on the plane borders. By default the lines run parallel to the plane's
// edges (its local axes).
// Returns { position, baseMapId, group, axisA: [Vector3, Vector3],
// axisB: [Vector3, Vector3], axisKeys? } | null.
//
// options.axes: the user axes of the gizmo frame ([{ key, dir }], see
// getUserAxesWorldDirections). The cross lines then follow the two user axes
// lying in the plane (getUserAxesInPlane — on a horizontal plan X and Y,
// rotated by the frame yaw) and the hit carries `axisKeys: { A, B }`: the
// in-plane ortho lock and the vertex alignment (computeSnapTarget) follow
// the frame rotation rather than the image edges.
// options.excludeSubtree: skip planes inside this group (e.g. the carried
// base map).
// options.onlyBaseMapId: keep only the planes of that base map (e.g. the 3D
// rectangle draw, whose second corner must stay on the anchor's plan).
// options.preferredBaseMapId: among (nearly) coplanar hits — several base
// maps left at the default pose stack at the origin — pick that base map's
// plane instead of the arbitrary closest hit. Same disambiguation rule as
// the move tool's findBaseMapGroupsAtVertex ("the selected base map wins").

// Two stacked hits closer than this along the ray are the "same" surface.
const COPLANAR_HIT_EPS_M = 1e-3;

function getOwningBaseMapGroup(mesh) {
  let node = mesh;
  while (node) {
    if (node.userData?.kind === "baseMap") return node;
    node = node.parent;
  }
  return null;
}

// Parameters [t0, t1] of the segment of the 2D line `origin + t * dir`
// inside the box [min, max] (slab clipping), or null when the line misses
// the box or `dir` is null.
export function clipLineToBox2d(origin, dir, min, max) {
  let t0 = -Infinity;
  let t1 = Infinity;
  for (const k of ["x", "y"]) {
    const d = dir[k];
    const o = origin[k];
    if (Math.abs(d) < 1e-12) {
      if (o < min[k] - 1e-9 || o > max[k] + 1e-9) return null;
      continue;
    }
    const a = (min[k] - o) / d;
    const b = (max[k] - o) / d;
    t0 = Math.max(t0, Math.min(a, b));
    t1 = Math.min(t1, Math.max(a, b));
  }
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t0 >= t1) return null;
  return [t0, t1];
}

// Cross lines along the user axes lying in the plane of `mesh`, through the
// plane-local point `local`, clipped to the bounding box `bb` of the image.
function buildUserAxesCross(mesh, local, bb, axes, toWorld) {
  const normal = new Vector3(0, 0, 1).transformDirection(mesh.matrixWorld);
  const basis = getUserAxesInPlane(normal, axes);
  if (!basis) return null;
  const toLocal = new Matrix4().copy(mesh.matrixWorld).invert();
  const arm = (dirWorld) => {
    const d = dirWorld.clone().transformDirection(toLocal);
    const len = Math.hypot(d.x, d.y);
    if (len < 1e-9) return null;
    const dir = { x: d.x / len, y: d.y / len };
    const span = clipLineToBox2d(local, dir, bb.min, bb.max);
    if (!span) return null;
    return span.map((t) => toWorld(local.x + t * dir.x, local.y + t * dir.y));
  };
  const axisA = arm(basis.u);
  const axisB = arm(basis.v);
  if (!axisA || !axisB) return null;
  return { axisA, axisB, axisKeys: { A: basis.keys[0], B: basis.keys[1] } };
}

export default function intersectBaseMapPlane(
  editor,
  ndc,
  camera,
  options = {}
) {
  const scene = editor?.sceneManager?.scene;
  if (!scene || !camera) return null;
  const excludeSubtree = options.excludeSubtree ?? null;
  const onlyBaseMapId = options.onlyBaseMapId ?? null;
  const preferredBaseMapId = options.preferredBaseMapId ?? null;
  const axes = options.axes ?? null;

  // Visible base map plane meshes (raycaster does not check visibility).
  const planes = [];
  scene.traverse((obj) => {
    if (!obj.isMesh || !obj.userData?.isBasemap) return;
    let parent = obj;
    while (parent) {
      if (parent.visible === false) return;
      if (excludeSubtree && parent === excludeSubtree) return;
      parent = parent.parent;
    }
    if (onlyBaseMapId) {
      let node = obj;
      while (node && node.userData?.kind !== "baseMap") node = node.parent;
      if (node?.userData?.baseMapId !== onlyBaseMapId) return;
    }
    planes.push(obj);
  });
  if (!planes.length) return null;

  const raycaster = new Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(planes, false);
  if (!hits.length) return null;

  let hit = hits[0];
  if (preferredBaseMapId) {
    const preferred = hits.find(
      (h) =>
        h.distance - hits[0].distance < COPLANAR_HIT_EPS_M &&
        getOwningBaseMapGroup(h.object)?.userData?.baseMapId ===
          preferredBaseMapId
    );
    if (preferred) hit = preferred;
  }
  const mesh = hit.object;

  const group = getOwningBaseMapGroup(mesh);
  const baseMapId = group?.userData?.baseMapId;
  if (!group || !baseMapId) return null;

  // Cross lines in the plane's LOCAL frame (PlaneGeometry in XY), clipped to
  // the image rectangle via the geometry bounding box.
  const geom = mesh.geometry;
  if (!geom.boundingBox) geom.computeBoundingBox();
  const bb = geom.boundingBox;
  const local = mesh.worldToLocal(hit.point.clone());

  const toWorld = (x, y) => mesh.localToWorld(new Vector3(x, y, local.z));
  // The user axes in the plane when the caller passes them (and both lie
  // across the image), else the image edges.
  const userCross = axes?.length
    ? buildUserAxesCross(mesh, local, bb, axes, toWorld)
    : null;
  const axisA = userCross?.axisA ?? [
    toWorld(bb.min.x, local.y),
    toWorld(bb.max.x, local.y),
  ];
  const axisB = userCross?.axisB ?? [
    toWorld(local.x, bb.min.y),
    toWorld(local.x, bb.max.y),
  ];

  return {
    position: hit.point.clone(),
    baseMapId,
    group,
    axisA,
    axisB,
    ...(userCross ? { axisKeys: userCross.axisKeys } : {}),
  };
}
