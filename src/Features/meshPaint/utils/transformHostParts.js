// Rigid transforms of host parts (buildHostPartIndex islands / chains) and of
// local paint geometries between base map frames, on plain column-major 4×4
// matrices (`THREE.Matrix4.elements` layout) — no three.js, node-testable.
//
// Used by the procedure-driven metering (« Quantités clé »): the parts of
// every pool host are brought into ONE frame (the plan's) to be classified
// and welded together, then sent back to their host's frame to be stored as
// paints.

import { length, normalize } from "../../threedMesh/utils/vec3Utils.js";

export const IDENTITY_MAT4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function applyMat4Point(m, p) {
  const x = p.x;
  const y = p.y;
  const z = p.z;
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
  return {
    x: (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    y: (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    z: (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
  };
}

// Rigid frames only: the 3×3 part rotates a direction (no inverse transpose).
export function applyMat4Normal(m, n) {
  const v = {
    x: m[0] * n.x + m[4] * n.y + m[8] * n.z,
    y: m[1] * n.x + m[5] * n.y + m[9] * n.z,
    z: m[2] * n.x + m[6] * n.y + m[10] * n.z,
  };
  return length(v) > 0 ? normalize(v) : v;
}

// a × b (column-major, same convention as THREE.Matrix4.multiplyMatrices).
export function multiplyMat4(a, b) {
  const out = new Array(16);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[row + 4 * k] * b[k + 4 * col];
      out[row + 4 * col] = sum;
    }
  }
  return out;
}

// General 4×4 inverse (THREE.Matrix4.invert); null when singular.
export function invertMat4(te) {
  const [
    n11,
    n21,
    n31,
    n41,
    n12,
    n22,
    n32,
    n42,
    n13,
    n23,
    n33,
    n43,
    n14,
    n24,
    n34,
    n44,
  ] = te;
  const t11 =
    n23 * n34 * n42 -
    n24 * n33 * n42 +
    n24 * n32 * n43 -
    n22 * n34 * n43 -
    n23 * n32 * n44 +
    n22 * n33 * n44;
  const t12 =
    n14 * n33 * n42 -
    n13 * n34 * n42 -
    n14 * n32 * n43 +
    n12 * n34 * n43 +
    n13 * n32 * n44 -
    n12 * n33 * n44;
  const t13 =
    n13 * n24 * n42 -
    n14 * n23 * n42 +
    n14 * n22 * n43 -
    n12 * n24 * n43 -
    n13 * n22 * n44 +
    n12 * n23 * n44;
  const t14 =
    n14 * n23 * n32 -
    n13 * n24 * n32 -
    n14 * n22 * n33 +
    n12 * n24 * n33 +
    n13 * n22 * n34 -
    n12 * n23 * n34;
  const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
  if (det === 0) return null;
  const d = 1 / det;
  return [
    t11 * d,
    (n24 * n33 * n41 -
      n23 * n34 * n41 -
      n24 * n31 * n43 +
      n21 * n34 * n43 +
      n23 * n31 * n44 -
      n21 * n33 * n44) *
      d,
    (n22 * n34 * n41 -
      n24 * n32 * n41 +
      n24 * n31 * n42 -
      n21 * n34 * n42 -
      n22 * n31 * n44 +
      n21 * n32 * n44) *
      d,
    (n23 * n32 * n41 -
      n22 * n33 * n41 -
      n23 * n31 * n42 +
      n21 * n33 * n42 +
      n22 * n31 * n43 -
      n21 * n32 * n43) *
      d,
    t12 * d,
    (n13 * n34 * n41 -
      n14 * n33 * n41 +
      n14 * n31 * n43 -
      n11 * n34 * n43 -
      n13 * n31 * n44 +
      n11 * n33 * n44) *
      d,
    (n14 * n32 * n41 -
      n12 * n34 * n41 -
      n14 * n31 * n42 +
      n11 * n34 * n42 +
      n12 * n31 * n44 -
      n11 * n32 * n44) *
      d,
    (n12 * n33 * n41 -
      n13 * n32 * n41 +
      n13 * n31 * n42 -
      n11 * n33 * n42 -
      n12 * n31 * n43 +
      n11 * n32 * n43) *
      d,
    t13 * d,
    (n14 * n23 * n41 -
      n13 * n24 * n41 -
      n14 * n21 * n43 +
      n11 * n24 * n43 +
      n13 * n21 * n44 -
      n11 * n23 * n44) *
      d,
    (n12 * n24 * n41 -
      n14 * n22 * n41 +
      n14 * n21 * n42 -
      n11 * n24 * n42 -
      n12 * n21 * n44 +
      n11 * n22 * n44) *
      d,
    (n13 * n22 * n41 -
      n12 * n23 * n41 -
      n13 * n21 * n42 +
      n11 * n23 * n42 +
      n12 * n21 * n43 -
      n11 * n22 * n43) *
      d,
    t14 * d,
    (n13 * n24 * n31 -
      n14 * n23 * n31 +
      n14 * n21 * n33 -
      n11 * n24 * n33 -
      n13 * n21 * n34 +
      n11 * n23 * n34) *
      d,
    (n14 * n22 * n31 -
      n12 * n24 * n31 -
      n14 * n21 * n32 +
      n11 * n24 * n32 +
      n12 * n21 * n34 -
      n11 * n22 * n34) *
      d,
    (n12 * n23 * n31 -
      n13 * n22 * n31 +
      n13 * n21 * n32 -
      n11 * n23 * n32 -
      n12 * n21 * n33 +
      n11 * n22 * n33) *
      d,
  ];
}

const mapLoop = (loop, m) => (loop || []).map((p) => applyMat4Point(m, p));

export function transformPolygons(polygons, m) {
  return (polygons || []).map((polygon) => ({
    contour: mapLoop(polygon.contour, m),
    holes: (polygon.holes || []).map((hole) => mapLoop(hole, m)),
  }));
}

export function transformIslands(islands, m) {
  return (islands || []).map((island) => ({
    ...island,
    polygons: transformPolygons(island.polygons, m),
    normal: applyMat4Normal(m, island.normal),
    centroid: applyMat4Point(m, island.centroid),
  }));
}

export function transformChains(chains, m) {
  return (chains || []).map((chain) => ({
    ...chain,
    points: chain.points.map((p) => applyMat4Point(m, p)),
    sides: (chain.sides || []).map((n) => applyMat4Normal(m, n)),
  }));
}

// LocalFace { polygons, normal } | LocalEdge { points, sides? } through `m`.
export function transformLocalGeometry(partType, geometry, m) {
  if (!geometry) return geometry;
  if (partType === "EDGE" || Array.isArray(geometry.points)) {
    return {
      ...geometry,
      points: (geometry.points || []).map((p) => applyMat4Point(m, p)),
      ...(geometry.sides
        ? { sides: geometry.sides.map((n) => applyMat4Normal(m, n)) }
        : {}),
    };
  }
  return {
    ...geometry,
    polygons: transformPolygons(geometry.polygons, m),
    ...(geometry.normal ? { normal: applyMat4Normal(m, geometry.normal) } : {}),
  };
}

// Axis-aligned box of a set of islands (null when empty).
export function islandsBox(islands) {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  let any = false;
  for (const island of islands || []) {
    for (const polygon of island.polygons || []) {
      for (const p of [
        ...(polygon.contour || []),
        ...(polygon.holes || []).flat(),
      ]) {
        any = true;
        for (const k of ["x", "y", "z"]) {
          if (p[k] < min[k]) min[k] = p[k];
          if (p[k] > max[k]) max[k] = p[k];
        }
      }
    }
  }
  return any ? { min, max } : null;
}

/**
 * A host's parts (buildHostPartIndex result) brought into another frame.
 * @param {{islands, chains}} index
 * @param {number[]} m column-major 4×4
 * @returns {{islands, chains, box}}
 */
export function transformHostParts(index, m) {
  const islands = transformIslands(index?.islands, m);
  return {
    islands,
    chains: transformChains(index?.chains, m),
    box: islandsBox(islands),
  };
}
