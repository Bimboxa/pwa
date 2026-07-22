import buildShellFromRegion from "./buildShellFromRegion.js";
import splitTrisIntoComponents from "./splitTrisIntoComponents.js";
import { isEdgeOnSeams, filterSeamsForPoints } from "./seamUtils.js";
import { dot } from "./vec3Utils.js";

// Axis cut of a curved (shell) maille, restricted to the facets FACING THE
// USER: a plane meets a wrapped surface — a 360° ribbon, a swept profile
// coming back on itself — in several separate lines, and cutting all of them
// at once both reads wrong (several red traits for one gesture) and splits the
// maille where the user never aimed.
//
// So only the chain of crossed triangles holding the hovered point is cut, and
// the result is the CONNECTED COMPONENTS of the cut surface, seams excluded.
// Cutting a closed ribbon once therefore yields a single (now open) maille;
// cutting it again splits it in two.
//
// Pure (no three.js), world coordinates.

const EPS = 1e-9;

function lerpPoint(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function clipToHalfSpace(poly, dists, sign) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    const di = sign * dists[i];
    const dj = sign * dists[j];
    if (di >= -EPS) out.push(poly[i]);
    if ((di > EPS && dj < -EPS) || (di < -EPS && dj > EPS)) {
      out.push(lerpPoint(poly[i], poly[j], di / (di - dj)));
    }
  }
  return out;
}

function pushFan(target, poly) {
  for (let i = 1; i + 1 < poly.length; i++) {
    target.push(poly[0], poly[i], poly[i + 1]);
  }
}

// The two points where the plane crosses a triangle (its share of the cut
// line), or null when it only grazes a corner.
function triPlaneSegment(tri, dists) {
  const points = [];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    if (Math.abs(dists[i]) <= EPS) {
      points.push(tri[i]);
      continue;
    }
    if (dists[i] * dists[j] < 0) {
      points.push(lerpPoint(tri[i], tri[j], dists[i] / (dists[i] - dists[j])));
    }
  }
  if (points.length < 2) return null;
  const [p, q] = points;
  const len = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
  return len > EPS ? [p, q] : null;
}

const centroid = (tri) => ({
  x: (tri[0].x + tri[1].x + tri[2].x) / 3,
  y: (tri[0].y + tri[1].y + tri[2].y) / 3,
  z: (tri[0].z + tri[1].z + tri[2].z) / 3,
});

const dist3 = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);

/**
 * @param {object} args
 * @param {ArrayLike<number>} args.positions - flat triangle soup (world)
 * @param {{normal, constant}} args.plane - dot(normal, p) === constant
 * @param {{x,y,z}} args.hitPoint - point under the cursor: picks the chain
 * @param {[[{x,y,z},{x,y,z}]]} [args.seams] - seams already carried
 * @returns {{ pieces: [{shell, seams}], segments }} pieces sorted by surface
 *   desc (one single piece = the cut opened the maille without splitting it);
 *   `segments` is the red preview line.
 */
export default function cutShellByPlaneNear({
  positions,
  plane,
  hitPoint,
  seams = [],
}) {
  if (!positions?.length || !plane?.normal) return null;
  const { normal, constant } = plane;

  const triCount = Math.floor(positions.length / 9);
  const triangles = [];
  const distsByTri = [];
  for (let t = 0; t < triCount; t++) {
    const tri = [0, 1, 2].map((k) => ({
      x: positions[9 * t + 3 * k],
      y: positions[9 * t + 3 * k + 1],
      z: positions[9 * t + 3 * k + 2],
    }));
    triangles.push(tri);
    distsByTri.push(tri.map((p) => dot(normal, p) - constant));
  }

  // Triangles the plane really goes through.
  const crossing = [];
  for (let t = 0; t < triCount; t++) {
    const d = distsByTri[t];
    if (d.some((v) => v > EPS) && d.some((v) => v < -EPS)) crossing.push(t);
  }
  if (!crossing.length) return null;

  // The plane cuts a wrapped surface along several separate chains: keep the
  // one nearest to the cursor.
  const chains = splitTrisIntoComponents({
    positions,
    index: null,
    tris: crossing,
  });
  let chain = chains[0];
  if (chains.length > 1 && hitPoint) {
    let best = Infinity;
    for (const candidate of chains) {
      const d = Math.min(
        ...candidate.map((t) => dist3(centroid(triangles[t]), hitPoint))
      );
      if (d < best) {
        best = d;
        chain = candidate;
      }
    }
  }
  const inChain = new Set(chain);

  // Clip the chain triangles, keep every other one untouched.
  const out = [];
  const newSeams = [];
  for (let t = 0; t < triCount; t++) {
    const tri = triangles[t];
    if (!inChain.has(t)) {
      out.push(...tri);
      continue;
    }
    const dists = distsByTri[t];
    const segment = triPlaneSegment(tri, dists);
    if (segment) newSeams.push(segment);
    pushFan(out, clipToHalfSpace(tri, dists, 1));
    pushFan(out, clipToHalfSpace(tri, dists, -1));
  }
  if (!newSeams.length) return null;

  const allSeams = [...(seams || []), ...newSeams];
  const flat = new Array(3 * out.length);
  out.forEach((p, i) => {
    flat[3 * i] = p.x;
    flat[3 * i + 1] = p.y;
    flat[3 * i + 2] = p.z;
  });

  const components = splitTrisIntoComponents({
    positions: flat,
    index: null,
    tris: Array.from({ length: out.length / 3 }, (_, i) => i),
    isSeamEdge: (p, q) => isEdgeOnSeams(p, q, allSeams),
  });

  const pieces = [];
  for (const component of components) {
    const shell = buildShellFromRegion({
      positions: flat,
      index: null,
      tris: component,
    });
    if (!shell) continue;
    const vertices = [];
    for (let i = 0; i < shell.positions.length; i += 3) {
      vertices.push({
        x: shell.positions[i],
        y: shell.positions[i + 1],
        z: shell.positions[i + 2],
      });
    }
    pieces.push({
      shell,
      seams: filterSeamsForPoints(allSeams, vertices),
    });
  }
  if (!pieces.length) return null;
  pieces.sort((p1, p2) => p2.shell.surface - p1.shell.surface);

  return { pieces, segments: newSeams };
}
