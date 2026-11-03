// Minimal plain-object vector helpers shared by the cut-line utilities. No
// three.js: these run in node tests and inside pure geometry code.

export const vec3 = (x = 0, y = 0, z = 0) => ({ x, y, z });

export const copy = (a) => ({ x: a.x, y: a.y, z: a.z });

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

export const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });

export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

export const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

export const lengthSq = (a) => dot(a, a);

export const length = (a) => Math.sqrt(lengthSq(a));

export const distanceSq = (a, b) => lengthSq(sub(a, b));

export const distance = (a, b) => Math.sqrt(distanceSq(a, b));

// Unit vector, or null when the input is (nearly) zero.
export const normalize = (a) => {
  if (!a) return null;
  const l = length(a);
  return l < 1e-12 ? null : scale(a, 1 / l);
};

export const lerp = (a, b, t) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});
