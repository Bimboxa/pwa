// Hand-built triangle soups for the cut-line tests: plain { a, b, c, n }
// world triangles with unit winding normals.

const v = (x, y, z) => ({ x, y, z });

function windingNormal(a, b, c) {
  const u = v(b.x - a.x, b.y - a.y, b.z - a.z);
  const w = v(c.x - a.x, c.y - a.y, c.z - a.z);
  const n = v(
    u.y * w.z - u.z * w.y,
    u.z * w.x - u.x * w.z,
    u.x * w.y - u.y * w.x
  );
  const l = Math.hypot(n.x, n.y, n.z);
  return v(n.x / l, n.y / l, n.z / l);
}

export function tri(a, b, c) {
  return { a, b, c, n: windingNormal(a, b, c) };
}

// Quad split along the a-c diagonal, wound so that its normal matches
// `outward` (flipped when the given corner order points the other way).
function quad(a, b, c, d, outward) {
  const n = windingNormal(a, b, c);
  const flip = n.x * outward.x + n.y * outward.y + n.z * outward.z < 0;
  return flip ? [tri(a, c, b), tri(a, d, c)] : [tri(a, b, c), tri(a, c, d)];
}

// Horizontal slab [0,size]² at height z, normal +z, cut into grid×grid cells
// of 2 triangles each (2 triangles for grid = 1, 8 for grid = 2).
export function slab({ size = 10, z = 0, grid = 1 } = {}) {
  const out = [];
  const step = size / grid;
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      const x0 = i * step;
      const y0 = j * step;
      out.push(
        ...quad(
          v(x0, y0, z),
          v(x0 + step, y0, z),
          v(x0 + step, y0 + step, z),
          v(x0, y0 + step, z),
          v(0, 0, 1)
        )
      );
    }
  }
  return out;
}

// Closed axis-aligned box, 12 triangles, outward normals.
export function box({ min, max }) {
  const [x0, y0, z0] = [min.x, min.y, min.z];
  const [x1, y1, z1] = [max.x, max.y, max.z];
  return [
    // bottom (-z) / top (+z)
    ...quad(
      v(x0, y0, z0),
      v(x1, y0, z0),
      v(x1, y1, z0),
      v(x0, y1, z0),
      v(0, 0, -1)
    ),
    ...quad(
      v(x0, y0, z1),
      v(x1, y0, z1),
      v(x1, y1, z1),
      v(x0, y1, z1),
      v(0, 0, 1)
    ),
    // front (-y) / back (+y)
    ...quad(
      v(x0, y0, z0),
      v(x1, y0, z0),
      v(x1, y0, z1),
      v(x0, y0, z1),
      v(0, -1, 0)
    ),
    ...quad(
      v(x0, y1, z0),
      v(x1, y1, z0),
      v(x1, y1, z1),
      v(x0, y1, z1),
      v(0, 1, 0)
    ),
    // left (-x) / right (+x)
    ...quad(
      v(x0, y0, z0),
      v(x0, y1, z0),
      v(x0, y1, z1),
      v(x0, y0, z1),
      v(-1, 0, 0)
    ),
    ...quad(
      v(x1, y0, z0),
      v(x1, y1, z0),
      v(x1, y1, z1),
      v(x1, y0, z1),
      v(1, 0, 0)
    ),
  ];
}

// 10 × 0.2 × 3 wall standing on the slab, y ∈ [5, 5.2].
export function wall() {
  return box({ min: v(0, 5, 0), max: v(10, 5.2, 3) });
}

// Open vertical sheet in the plane y = `y`, x ∈ [x0, x1], z ∈ [0, height]:
// one quad, no thickness, no caps, normal -y (a sweep met edge-on).
export function sheet({ y = 5, x0 = 0, x1 = 10, height = 3 } = {}) {
  return quad(
    v(x0, y, 0),
    v(x1, y, 0),
    v(x1, y, height),
    v(x0, y, height),
    v(0, -1, 0)
  );
}

// Open curved sheet: a quarter-circle profile in the (y, z) plane, from the
// foot (y, 0) up to (y + radius, radius), swept along x ∈ [x0, x1] in `steps`
// quads (2 triangles each, winding normals facing -y / +z). Its section by a
// plane x = const goes through ~2 raw nodes per quad.
export function curvedSheet({
  y = 5,
  x0 = 0,
  x1 = 10,
  radius = 6,
  steps = 40,
} = {}) {
  const out = [];
  const at = (i) => {
    const t = ((i / steps) * Math.PI) / 2;
    return { y: y + radius * (1 - Math.cos(t)), z: radius * Math.sin(t) };
  };
  for (let i = 0; i < steps; i++) {
    const a = at(i);
    const b = at(i + 1);
    const outward = v(0, -Math.cos((i / steps) * Math.PI), 0.5);
    out.push(
      ...quad(
        v(x0, a.y, a.z),
        v(x1, a.y, a.z),
        v(x1, b.y, b.z),
        v(x0, b.y, b.z),
        outward
      )
    );
  }
  return out;
}

export const P = v;

// Assertion helpers shared by the tests.
export const near = (actual, expected, eps = 1e-6) => {
  if (Math.abs(actual - expected) > eps) {
    throw new Error(`expected ${expected}, got ${actual}`);
  }
};

export const nearPoint = (actual, expected, eps = 1e-6) => {
  if (!actual) throw new Error(`expected a point, got ${actual}`);
  const ok =
    Math.abs(actual.x - expected.x) <= eps &&
    Math.abs(actual.y - expected.y) <= eps &&
    Math.abs(actual.z - expected.z) <= eps;
  if (!ok) {
    throw new Error(
      `expected (${expected.x}, ${expected.y}, ${expected.z}), got (${actual.x}, ${actual.y}, ${actual.z})`
    );
  }
};

export const nearPoints = (actual, expected, eps = 1e-6) => {
  if (actual.length !== expected.length) {
    throw new Error(
      `expected ${expected.length} points, got ${actual.length}: ${JSON.stringify(actual)}`
    );
  }
  expected.forEach((p, i) => nearPoint(actual[i], p, eps));
};
