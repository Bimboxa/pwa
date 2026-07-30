// Minimal 3x3 linear algebra on flat row-major Array(9) matrices and plain
// {x, y, z} vectors. Used by the photoPlan calibration math — plain arrays so
// the results serialize straight into Dexie / JSON (no three.js types).

const EPS = 1e-12;

export function mat3Identity() {
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

export function mat3Multiply(a, b) {
  const out = new Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[3 * r + c] =
        a[3 * r] * b[c] + a[3 * r + 1] * b[3 + c] + a[3 * r + 2] * b[6 + c];
    }
  }
  return out;
}

// Inverse via the adjugate. Returns null when the matrix is singular.
export function mat3Invert(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  const scale = Math.max(...m.map((v) => Math.abs(v)), 1);
  if (Math.abs(det) < EPS * scale * scale * scale) return null;
  return [
    A / det,
    -(b * i - c * h) / det,
    (b * f - c * e) / det,
    B / det,
    (a * i - c * g) / det,
    -(a * f - c * d) / det,
    C / det,
    -(a * h - b * g) / det,
    (a * e - b * d) / det,
  ];
}

// Apply to a 2D point as homogeneous (x, y, 1). Returns {x, y, w} — the
// caller decides how to guard the dehomogenization (horizon side).
export function mat3ApplyToPoint(m, { x, y }) {
  return {
    x: m[0] * x + m[1] * y + m[2],
    y: m[3] * x + m[4] * y + m[5],
    w: m[6] * x + m[7] * y + m[8],
  };
}

// Apply to a raw homogeneous triplet [x, y, w].
export function mat3ApplyToH(m, [x, y, w]) {
  return [
    m[0] * x + m[1] * y + m[2] * w,
    m[3] * x + m[4] * y + m[5] * w,
    m[6] * x + m[7] * y + m[8] * w,
  ];
}

// Divide by the max-abs entry (storage stability). `wSignPoint` is an
// optional {x, y} whose image must have w > 0 (fixes the projective sign so
// the valid side of the horizon is w > 0).
export function mat3NormalizeScale(m, wSignPoint) {
  const max = Math.max(...m.map((v) => Math.abs(v)));
  if (max < EPS) return m.slice();
  let out = m.map((v) => v / max);
  if (wSignPoint) {
    const { w } = mat3ApplyToPoint(out, wSignPoint);
    if (w < 0) out = out.map((v) => -v);
  }
  return out;
}

// Smallest-eigenvalue eigenvector of a SYMMETRIC 3x3 matrix (cyclic Jacobi).
// Deterministic, exact enough for the 2-segment vanishing-point minimum.
// Returns { vector: [x, y, z] (unit), values: [l0, l1, l2] ascending }.
export function mat3SmallestEigenvector(m) {
  // Work on a copy A; accumulate rotations in V.
  const A = m.slice();
  const V = mat3Identity();
  const at = (r, c) => A[3 * r + c];
  const set = (r, c, v) => {
    A[3 * r + c] = v;
  };

  for (let sweep = 0; sweep < 32; sweep++) {
    let off =
      Math.abs(at(0, 1)) + Math.abs(at(0, 2)) + Math.abs(at(1, 2));
    if (off < 1e-15 * (Math.abs(at(0, 0)) + Math.abs(at(1, 1)) + Math.abs(at(2, 2)) + 1e-30)) break;
    for (const [p, q] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ]) {
      const apq = at(p, q);
      if (Math.abs(apq) < 1e-30) continue;
      const theta = (at(q, q) - at(p, p)) / (2 * apq);
      const t =
        Math.sign(theta || 1) /
        (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1);
      const s = t * c;
      // Rotate A on both sides.
      for (let k = 0; k < 3; k++) {
        const akp = at(k, p);
        const akq = at(k, q);
        set(k, p, c * akp - s * akq);
        set(k, q, s * akp + c * akq);
      }
      for (let k = 0; k < 3; k++) {
        const apk = at(p, k);
        const aqk = at(q, k);
        set(p, k, c * apk - s * aqk);
        set(q, k, s * apk + c * aqk);
      }
      // Accumulate in V (columns are eigenvectors).
      for (let k = 0; k < 3; k++) {
        const vkp = V[3 * k + p];
        const vkq = V[3 * k + q];
        V[3 * k + p] = c * vkp - s * vkq;
        V[3 * k + q] = s * vkp + c * vkq;
      }
    }
  }

  const values = [at(0, 0), at(1, 1), at(2, 2)];
  const order = [0, 1, 2].sort((i, j) => values[i] - values[j]);
  const k = order[0];
  return {
    vector: [V[k], V[3 + k], V[6 + k]],
    values: order.map((i) => values[i]),
  };
}

// --- plain {x,y,z} vector helpers ---

export function v3Dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function v3Cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function v3Norm(a) {
  return Math.hypot(a.x, a.y, a.z);
}

export function v3Normalize(a) {
  const n = v3Norm(a);
  if (n < EPS) return null;
  return { x: a.x / n, y: a.y / n, z: a.z / n };
}

export function v3Scale(a, s) {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function v3Sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function v3Add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
