import { GEOM_HASH_QUANTUM_M } from "../constants/meshPaintConstants.js";

// Fingerprint of a host's displayed geometry (re-sync change detection):
// vertices quantized to `quantum` meters, independent of the triangle order
// AND of the vertex order inside a triangle (winding included). Each
// triangle is hashed on its sorted quantized vertices (two FNV-1a 32-bit
// streams); the triangle hashes are combined with commutative sums + xor,
// plus the triangle count.
//
// triangles: flat xyz array, 9 numbers per triangle. Pure: node-testable.

const FNV_OFFSET_A = 0x811c9dc5;
const FNV_OFFSET_B = 0x01000193 ^ 0x5bd1e995;
const FNV_PRIME = 0x01000193;

function mix(h, value) {
  // Two 16-bit halves of the (possibly large / negative) integer.
  let x = h ^ (value & 0xffff);
  x = Math.imul(x, FNV_PRIME);
  x ^= Math.floor(value / 65536) & 0xffff;
  return Math.imul(x, FNV_PRIME);
}

const compareTuples = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

export default function hashTriangles(
  triangles,
  quantum = GEOM_HASH_QUANTUM_M
) {
  const triCount = Math.floor((triangles?.length || 0) / 9);
  const q = (v) => Math.round((Number(v) || 0) / quantum) + 0; // no -0
  let sumA = 0;
  let sumB = 0;
  let xorA = 0;
  for (let t = 0; t < triCount; t++) {
    const o = 9 * t;
    const vertices = [
      [q(triangles[o]), q(triangles[o + 1]), q(triangles[o + 2])],
      [q(triangles[o + 3]), q(triangles[o + 4]), q(triangles[o + 5])],
      [q(triangles[o + 6]), q(triangles[o + 7]), q(triangles[o + 8])],
    ].sort(compareTuples);
    let hA = FNV_OFFSET_A;
    let hB = FNV_OFFSET_B;
    for (const vertex of vertices) {
      for (const value of vertex) {
        hA = mix(hA, value);
        hB = mix(hB, value ^ 0x2545f491);
      }
    }
    hA >>>= 0;
    hB >>>= 0;
    sumA = (sumA + hA) >>> 0;
    sumB = (sumB + Math.imul(hB, 0x9e3779b1)) >>> 0;
    xorA = (xorA ^ hB) >>> 0;
  }
  return `${triCount}-${sumA.toString(36)}-${sumB.toString(36)}-${xorA.toString(36)}`;
}
