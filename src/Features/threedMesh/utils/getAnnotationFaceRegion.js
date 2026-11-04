import {
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Vector3,
} from "three";

import { getFaceRegion } from "Features/threedEditor/js/utilsAnnotationsManager/faceHoverHighlight";

// Face region of the Maillage module, grown over the WHOLE annotation.
//
// getFaceRegion walks one BufferGeometry, but an annotation often spans
// several meshes: an isMesh3d annotation is rendered one Mesh per face (see
// buildMesh3dAnnotationObject), a multi-segment POLYLINE wall one per
// segment, a REVOLUTION one per run. Hovered on such a host, the region
// could never leave the hit mesh — one facet of a curved sheet. Here the
// solid meshes of the annotation are merged into one geometry (cached per
// annotation root, in the root's local frame) and the region is grown on
// it, so the "Sélection de face" angle follows the facets across the meshes,
// like the Pinceau's host index does.
//
// The Dessin module's hover keeps its per-mesh region on purpose (push/pull
// and face selection address one face).
//
// Returns { key, host, geometry, tris, triIndex, merged } or null:
// - key: hover cache key (host uuid, angle, region id);
// - host: the Object3D to attach a local-coordinates overlay to and whose
//   matrixWorld maps `geometry` to world (the annotation root when merged,
//   the hit mesh otherwise);
// - tris: triangle indices of the region in `geometry`;
// - triIndex: index of the hit triangle in `geometry`.

const hostCache = new WeakMap(); // annotation root -> merged host

function findAnnotationRoot(object) {
  let node = object;
  while (node) {
    if (node.userData?.nodeType === "ANNOTATION") return node;
    node = node.parent;
  }
  return null;
}

// Solid meshes of the annotation (same filter as
// collectAnnotationSectionMeshes), hidden chains dropped — a hidden listing
// or part must neither be highlighted nor meshed.
export function collectAnnotationSolidMeshes(root) {
  const meshes = [];
  root?.traverse?.((child) => {
    if (child.isLine2 || child.isLineSegments2) return;
    if (child.userData?.isSectionMarker) return;
    if (child.userData?.isDecor) return;
    if (child.userData?.isHoverOverlay) return;
    if (child.userData?.isPaintOverlay) return;
    if (!child.isMesh || !child.geometry?.getAttribute?.("position")) return;
    let node = child;
    while (node && node !== root) {
      if (!node.visible) return;
      node = node.parent;
    }
    meshes.push(child);
  });
  return meshes;
}

function isCacheValid(cached, meshes) {
  if (!cached || cached.meshes.length !== meshes.length) return false;
  return cached.meshes.every(
    (mesh, i) => mesh === meshes[i] && cached.geometries[i] === mesh.geometry
  );
}

// The merged host of an annotation root: every solid mesh copied into ONE
// non-indexed geometry in the root's local frame. Null when the annotation
// has fewer than two solid meshes or a CSG-carved mesh (`hasSubtraction`:
// plane mode, one mesh anyway) — the caller then stays on the per-mesh path.
export function getAnnotationMergedHost(root) {
  if (!root) return null;
  const meshes = collectAnnotationSolidMeshes(root);
  if (meshes.length < 2) return null;
  if (meshes.some((mesh) => mesh.userData?.hasSubtraction)) return null;

  const cached = hostCache.get(root);
  if (isCacheValid(cached, meshes)) return cached;
  cached?.geometry?.dispose?.();

  root.updateWorldMatrix(true, false);
  const rootInverse = new Matrix4().copy(root.matrixWorld).invert();
  const local = new Matrix4();
  const v = new Vector3();
  const positions = [];
  const meshOfTri = [];
  const triOffsetByMesh = new Map();
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    local.multiplyMatrices(rootInverse, mesh.matrixWorld);
    const position = mesh.geometry.getAttribute("position");
    const index = mesh.geometry.getIndex();
    const triCount = Math.floor((index ? index.count : position.count) / 3);
    const vertIndex = index
      ? (t, c) => index.getX(3 * t + c)
      : (t, c) => 3 * t + c;
    triOffsetByMesh.set(mesh, meshOfTri.length);
    for (let t = 0; t < triCount; t++) {
      for (let c = 0; c < 3; c++) {
        v.fromBufferAttribute(position, vertIndex(t, c)).applyMatrix4(local);
        positions.push(v.x, v.y, v.z);
      }
      meshOfTri.push(mesh);
    }
  }
  if (!meshOfTri.length) return null;

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  const host = {
    root,
    geometry,
    meshes,
    geometries: meshes.map((mesh) => mesh.geometry),
    triCount: meshOfTri.length,
    meshOfTri,
    triIndexOf: (mesh, faceIndex) => {
      const offset = triOffsetByMesh.get(mesh);
      return offset === undefined ? null : offset + faceIndex;
    },
  };
  hostCache.set(root, host);
  return host;
}

export default function getAnnotationFaceRegion(
  object,
  faceIndex,
  { angleDeg } = {}
) {
  if (!object?.geometry) return null;
  const plane = !!object.userData?.hasSubtraction;
  const host = plane
    ? null
    : getAnnotationMergedHost(findAnnotationRoot(object));

  if (!host) {
    const region = getFaceRegion(object.geometry, faceIndex, {
      plane,
      angleDeg,
    });
    if (!region) return null;
    return {
      key: `${object.uuid}:${angleDeg}:${region.regionId}`,
      host: object,
      geometry: object.geometry,
      tris: region.tris,
      triIndex: faceIndex,
      merged: false,
    };
  }

  const triIndex = host.triIndexOf(object, faceIndex);
  if (triIndex === null) return null;
  const region = getFaceRegion(host.geometry, triIndex, { angleDeg });
  if (!region) return null;
  return {
    key: `${host.root.uuid}:${angleDeg}:${region.regionId}`,
    host: host.root,
    geometry: host.geometry,
    tris: region.tris,
    triIndex,
    merged: true,
  };
}
