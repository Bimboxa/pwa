// Plain-object 3D vector helpers ({x, y, z}). Kept free of three.js so the
// geometry utils built on top stay importable from node replay scripts.

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

export const scale = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });

export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

export const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export const length = (a) => Math.sqrt(dot(a, a));

export function normalize(a) {
  const len = length(a);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return scale(a, 1 / len);
}
