import { Raycaster, Vector3 } from "three";

// Raycast the pointer against the base map image planes (userData.isBasemap)
// and return the closest hit with the cross-helper geometry: the two lines
// through the hit point, parallel to the plane's edges (its local axes),
// clipped to the image rectangle — so they always END on the plane borders.
// Returns { position, baseMapId, group, axisA: [Vector3, Vector3],
// axisB: [Vector3, Vector3] } | null.
//
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
  const axisA = [toWorld(bb.min.x, local.y), toWorld(bb.max.x, local.y)];
  const axisB = [toWorld(local.x, bb.min.y), toWorld(local.x, bb.max.y)];

  return {
    position: hit.point.clone(),
    baseMapId,
    group,
    axisA,
    axisB,
  };
}
