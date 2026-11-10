import { BufferAttribute, BufferGeometry, Matrix4, Vector3 } from "three";

// Cuts a parsed glTF scene with the plane `axis = max` and keeps the side
// `axis <= max` (coordinates in the frame of `root`, glTF units). Used by
// the OBJECT_3D annotations laid along a path array (« Calepinage »,
// `annotation.object3DCut`): the last net panel of a run is shorter than the
// object.
//
// A real geometry cut rather than per-object clipping planes: the viewer owns
// `material.clippingPlanes` (global section plane, hover / dim material
// swaps), and a cut geometry also gives the right bounding box, snaps and
// exports. Triangles crossing the plane are split, every vertex attribute is
// interpolated; the section is left open (no cap).
//
// Mutates `root`: meshes entirely beyond the plane are removed, crossed
// meshes get a new non-indexed geometry. Skinned meshes and non-mesh objects
// (lines, points) are left untouched.

function clipGeometry(geometry, distances) {
  const attributes = Object.entries(geometry.attributes);
  const index = geometry.index;
  const vertexCount = index ? index.count : geometry.attributes.position.count;
  const vertexAt = (k) => (index ? index.getX(k) : k);
  const groups = geometry.groups?.length
    ? geometry.groups
    : [{ start: 0, count: vertexCount, materialIndex: undefined }];

  // Output vertices as (a, b, t): lerp of source vertices a -> b.
  const outA = [];
  const outB = [];
  const outT = [];
  const push = (a, b, t) => {
    outA.push(a);
    outB.push(b);
    outT.push(t);
  };
  const outGroups = [];

  for (const group of groups) {
    const groupStart = outA.length;
    const end = Math.min(group.start + group.count, vertexCount);
    for (let k = group.start; k + 2 < end; k += 3) {
      const tri = [vertexAt(k), vertexAt(k + 1), vertexAt(k + 2)];
      const d = tri.map((v) => distances[v]);
      const inside = d.map((x) => x <= 0);
      if (inside[0] && inside[1] && inside[2]) {
        tri.forEach((v) => push(v, v, 0));
        continue;
      }
      if (!inside[0] && !inside[1] && !inside[2]) continue;
      // Sutherland–Hodgman against one plane: 3 or 4 vertices.
      const polygon = [];
      for (let e = 0; e < 3; e++) {
        const n = (e + 1) % 3;
        if (inside[e]) polygon.push([tri[e], tri[e], 0]);
        if (inside[e] !== inside[n])
          polygon.push([tri[e], tri[n], d[e] / (d[e] - d[n])]);
      }
      for (let f = 1; f + 1 < polygon.length; f++) {
        push(...polygon[0]);
        push(...polygon[f]);
        push(...polygon[f + 1]);
      }
    }
    outGroups.push({
      start: groupStart,
      count: outA.length - groupStart,
      materialIndex: group.materialIndex,
    });
  }

  const out = new BufferGeometry();
  const count = outA.length;
  for (const [name, attribute] of attributes) {
    const size = attribute.itemSize;
    const array = new Float32Array(count * size);
    for (let i = 0; i < count; i++) {
      const a = outA[i];
      const b = outB[i];
      const t = outT[i];
      for (let c = 0; c < size; c++) {
        const va = attribute.getComponent(a, c);
        array[i * size + c] =
          t === 0 ? va : va + (attribute.getComponent(b, c) - va) * t;
      }
    }
    out.setAttribute(name, new BufferAttribute(array, size));
  }
  if (geometry.groups?.length) {
    outGroups.forEach((g) => out.addGroup(g.start, g.count, g.materialIndex));
  }
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

export default function sliceObject3DAlongAxis(root, axis, max) {
  if (!root || !["x", "y", "z"].includes(axis) || !Number.isFinite(max)) return;

  root.updateMatrixWorld(true);
  const rootInverse = new Matrix4().copy(root.matrixWorld).invert();
  const toRoot = new Matrix4();
  const vertex = new Vector3();
  const toRemove = [];

  root.traverse((child) => {
    const position = child.geometry?.attributes?.position;
    if (!child.isMesh || child.isSkinnedMesh || !position) return;

    toRoot.multiplyMatrices(rootInverse, child.matrixWorld);
    const distances = new Float64Array(position.count);
    let insideCount = 0;
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(toRoot);
      distances[i] = vertex[axis] - max;
      if (distances[i] <= 0) insideCount++;
    }
    if (insideCount === position.count) return;
    if (insideCount === 0) {
      toRemove.push(child);
      return;
    }
    const previous = child.geometry;
    child.geometry = clipGeometry(previous, distances);
    previous.dispose();
  });

  toRemove.forEach((mesh) => {
    mesh.removeFromParent();
    mesh.geometry?.dispose();
  });
}
