import computePlaneBasis from "./computePlaneBasis.js";
import { computeMesh3dSurface } from "./computeFaceArea.js";
import {
  liftLoopTo3d,
  liftPointTo3d,
  projectLoopTo2d,
} from "./planeProjection.js";
import splitFacePolygon from "./splitFacePolygon.js";
import {
  SEAM_TOL_M,
  distSqPointToSegment3d,
  filterSeamsForPoints,
  isPointOnSeams,
} from "./seamUtils.js";
import { dot } from "./vec3Utils.js";

// Axis cut of a polygon (multi-face) maille, restricted to the facets FACING
// THE USER — the polygon counterpart of cutShellByPlaneNear, same rules:
//
// - a plane meets a wrapped maille (a profile swept along a closed polyline)
//   along several separate chains of facets: only the chain holding the
//   hovered point is cut, so one gesture draws one red trait;
// - the result is the CONNECTED COMPONENTS of the cut maille, seams excluded,
//   so a cut that does not separate anything creates no new maille — it just
//   opens the maille, and the seam is remembered for the next cut.
//
// Pure (no three.js), world coordinates.

const EPS = 1e-9;

function bboxOfLoops(loops) {
  const box = {
    minX: Infinity,
    minY: Infinity,
    minZ: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
    maxZ: -Infinity,
  };
  for (const loop of loops) {
    for (const p of loop) {
      if (p.x < box.minX) box.minX = p.x;
      if (p.y < box.minY) box.minY = p.y;
      if (p.z < box.minZ) box.minZ = p.z;
      if (p.x > box.maxX) box.maxX = p.x;
      if (p.y > box.maxY) box.maxY = p.y;
      if (p.z > box.maxZ) box.maxZ = p.z;
    }
  }
  return box;
}

const bboxesTouch = (b1, b2) =>
  b1.minX <= b2.maxX + SEAM_TOL_M &&
  b2.minX <= b1.maxX + SEAM_TOL_M &&
  b1.minY <= b2.maxY + SEAM_TOL_M &&
  b2.minY <= b1.maxY + SEAM_TOL_M &&
  b1.minZ <= b2.maxZ + SEAM_TOL_M &&
  b2.minZ <= b1.maxZ + SEAM_TOL_M;

const faceLoops = (face) => [
  face.contour,
  ...(face.holes || []).filter((hole) => hole?.length >= 3),
];

// Two faces are connected when a vertex of one lies on an edge of the other
// AWAY from any seam — a contact that only happens along a seam is exactly
// what a previous cut opened.
function facesTouch(loopsA, loopsB, seams) {
  const tolSq = SEAM_TOL_M * SEAM_TOL_M;
  const scan = (loops1, loops2) => {
    for (const loop1 of loops1) {
      for (const p of loop1) {
        if (isPointOnSeams(p, seams)) continue;
        for (const loop2 of loops2) {
          for (let i = 0; i < loop2.length; i++) {
            const a = loop2[i];
            const b = loop2[(i + 1) % loop2.length];
            if (distSqPointToSegment3d(p, a, b) <= tolSq) return true;
          }
        }
      }
    }
    return false;
  };
  return scan(loopsA, loopsB) || scan(loopsB, loopsA);
}

// The plane seen from inside a face: a 2D line, or null when the face is
// parallel to it (nothing to cut).
function toLine2d(plane, basis) {
  const n = { x: dot(plane.normal, basis.u), y: dot(plane.normal, basis.v) };
  const len = Math.hypot(n.x, n.y);
  if (len < 1e-9) return null;
  const c = (plane.constant - dot(plane.normal, basis.origin)) / len;
  return { n: { x: n.x / len, y: n.y / len }, c };
}

// Line ∩ face, clipped to the contour extents — same min/max convention as
// the historical single-face axis cut.
function lineSegmentInFace(line, contour2d) {
  const origin = { x: line.n.x * line.c, y: line.n.y * line.c };
  const dir = { x: -line.n.y, y: line.n.x };
  const ts = [];
  const n = contour2d.length;
  for (let i = 0; i < n; i++) {
    const p = contour2d[i];
    const q = contour2d[(i + 1) % n];
    const dp = p.x * line.n.x + p.y * line.n.y - line.c;
    const dq = q.x * line.n.x + q.y * line.n.y - line.c;
    if (dp * dq > 0) continue;
    if (Math.abs(dp - dq) < EPS) continue;
    const t = dp / (dp - dq);
    const x = p.x + t * (q.x - p.x);
    const y = p.y + t * (q.y - p.y);
    ts.push((x - origin.x) * dir.x + (y - origin.y) * dir.y);
  }
  if (ts.length < 2) return null;
  const tMin = Math.min(...ts);
  const tMax = Math.max(...ts);
  if (tMax - tMin < EPS) return null;
  return [
    { x: origin.x + tMin * dir.x, y: origin.y + tMin * dir.y },
    { x: origin.x + tMax * dir.x, y: origin.y + tMax * dir.y },
  ];
}

const dist3 = (p, q) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);

/**
 * @param {object} args
 * @param {Array<{contour, holes, normal}>} args.faces
 * @param {{normal, constant}} args.plane
 * @param {{x,y,z}} args.hitPoint - point under the cursor: picks the chain
 * @param {[[{x,y,z},{x,y,z}]]} [args.seams]
 * @returns {{ pieces: [{faces, surface, seams}], segments }} pieces sorted by
 *   surface desc; `segments` is the red preview line.
 */
export default function cutFacesByPlaneNear({
  faces,
  plane,
  hitPoint,
  seams = [],
}) {
  if (!faces?.length || !plane?.normal) return null;

  // 1. Where the plane crosses each face.
  const contexts = faces.map((face) => {
    if (!face?.contour || face.contour.length < 3) return null;
    const basis = computePlaneBasis(face.normal, face.contour[0]);
    const line = toLine2d(plane, basis);
    if (!line) return null;
    const contour2d = projectLoopTo2d(face.contour, basis);
    const segment2d = lineSegmentInFace(line, contour2d);
    if (!segment2d) return null;
    return {
      basis,
      line,
      contour2d,
      holes2d: (face.holes || [])
        .filter((hole) => hole?.length >= 3)
        .map((hole) => projectLoopTo2d(hole, basis)),
      segment2d,
      segment3d: segment2d.map((p) => liftPointTo3d(p, basis)),
    };
  });
  const crossed = contexts
    .map((ctx, index) => (ctx ? index : -1))
    .filter((index) => index >= 0);
  if (!crossed.length) return null;

  // 2. Chain the crossed facets by their touching cut ends, keep the chain
  // under the cursor: a wrapped maille is crossed in several places.
  const parent = new Map(crossed.map((index) => [index, index]));
  const find = (index) => {
    let root = index;
    while (parent.get(root) !== root) root = parent.get(root);
    return root;
  };
  for (let i = 0; i < crossed.length; i++) {
    for (let j = i + 1; j < crossed.length; j++) {
      const s1 = contexts[crossed[i]].segment3d;
      const s2 = contexts[crossed[j]].segment3d;
      const touching = s1.some((p) =>
        s2.some((q) => dist3(p, q) <= SEAM_TOL_M)
      );
      if (!touching) continue;
      const r1 = find(crossed[i]);
      const r2 = find(crossed[j]);
      if (r1 !== r2) parent.set(r1, r2);
    }
  }
  const chains = new Map();
  for (const index of crossed) {
    const root = find(index);
    if (!chains.has(root)) chains.set(root, []);
    chains.get(root).push(index);
  }
  let chain = [...chains.values()][0];
  if (chains.size > 1 && hitPoint) {
    let best = Infinity;
    for (const candidate of chains.values()) {
      const d = Math.min(
        ...candidate.flatMap((index) =>
          contexts[index].segment3d.map((p) => dist3(p, hitPoint))
        )
      );
      if (d < best) {
        best = d;
        chain = candidate;
      }
    }
  }

  // 3. Cut the chain facets, keep every other face untouched.
  const inChain = new Set(chain);
  const outFaces = [];
  const newSeams = [];
  faces.forEach((face, index) => {
    if (!inChain.has(index)) {
      outFaces.push(face);
      return;
    }
    const ctx = contexts[index];
    const pieces = splitFacePolygon({
      contour: ctx.contour2d,
      holes: ctx.holes2d,
      a: ctx.segment2d[0],
      b: ctx.segment2d[1],
    });
    if (!pieces || pieces.length < 2) {
      outFaces.push(face);
      return;
    }
    newSeams.push(ctx.segment3d);
    for (const piece of pieces) {
      outFaces.push({
        contour: liftLoopTo3d(piece.contour, ctx.basis),
        holes: piece.holes.map((hole) => liftLoopTo3d(hole, ctx.basis)),
        normal: face.normal,
      });
    }
  });
  if (!newSeams.length) return null;

  // 4. Connected components of the cut maille, seams opened.
  const allSeams = [...(seams || []), ...newSeams];
  const loopsByFace = outFaces.map(faceLoops);
  const bboxes = loopsByFace.map(bboxOfLoops);
  const componentOf = new Array(outFaces.length).fill(-1);
  const components = [];
  for (let seed = 0; seed < outFaces.length; seed++) {
    if (componentOf[seed] >= 0) continue;
    const componentIndex = components.length;
    const component = [];
    const stack = [seed];
    componentOf[seed] = componentIndex;
    while (stack.length) {
      const index = stack.pop();
      component.push(outFaces[index]);
      for (let other = 0; other < outFaces.length; other++) {
        if (componentOf[other] >= 0) continue;
        if (!bboxesTouch(bboxes[index], bboxes[other])) continue;
        if (!facesTouch(loopsByFace[index], loopsByFace[other], allSeams)) {
          continue;
        }
        componentOf[other] = componentIndex;
        stack.push(other);
      }
    }
    components.push(component);
  }

  const pieces = components.map((componentFaces) => ({
    faces: componentFaces,
    surface: computeMesh3dSurface(componentFaces),
    seams: filterSeamsForPoints(
      allSeams,
      componentFaces.flatMap(faceLoops).flat()
    ),
  }));
  pieces.sort((p1, p2) => p2.surface - p1.surface);

  return { pieces, segments: newSeams };
}
