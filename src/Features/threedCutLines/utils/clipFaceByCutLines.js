import computePlaneBasis from "../../threedMesh/utils/computePlaneBasis.js";
import {
  liftPointTo3d,
  projectPointTo2d,
} from "../../threedMesh/utils/planeProjection.js";
import {
  polygonArea2d,
  polygonCentroid2d,
  signedArea2d,
} from "../../threedMesh/utils/computeFaceArea.js";
import pointInPolygon2d from "../../threedMesh/utils/pointInPolygon2d.js";
import { dot, sub } from "../../threedMesh/utils/vec3Utils.js";
import getPathChunksInRegion, {
  distanceToBoundary,
  isInsideRegion,
} from "../../surfaceCut/utils/getPathChunksInRegion.js";
import splitFlatRegionAlongChunks from "../../surfaceCut/utils/splitFlatRegionAlongChunks.js";

// Pieces of a planar face delimited by the CUT_LINE polylines lying on it.
//
// face: { contour: [{x,y,z}], holes: [[{x,y,z}]], normal: {x,y,z} } in world
// coordinates, open loops (no closing point). cutLines: [[{x,y,z}]] world
// polylines. hitPoint: optional world point (the hovered point of the face).
//
// Each line is first split into its maximal runs of points lying on the face
// plane (within planeTolerance): a point off the plane (the line climbing a
// neighbor wall) ends the run. Each run of 2+ points is projected onto the
// face plane and clipped to the face (getPathChunksInRegion, boundary to
// boundary). The chunks are then drawn one after the other on the current
// pieces: a chunk crossing several pieces cuts each of them.
//
// Returns null when no chunk cuts the face (the whole face stands, uncut),
// else { pieces, hitPieceIndex, loops2d, basis } — pieces: [{ contour, holes,
// normal, area, centroid }] in world coordinates; hitPieceIndex: index of the
// piece containing hitPoint (holes excluded), -1 when none or no hitPoint;
// loops2d: [contour, ...holes] of the face in the plane basis.
export default function clipFaceByCutLines({
  face,
  cutLines,
  hitPoint = null,
  // A line point within this of the face plane lies on it (the extension
  // walks a 1 mm-quantized section graph, the stored altitudes keep 0.01 mm).
  planeTolerance = 1e-2,
  // Boundary snap of the line ends (same 1 mm quantization: an end found on
  // a face edge may sit a hair inside the face).
  tolerance = 5e-3,
}) {
  const contour = face?.contour;
  if (!contour || contour.length < 3 || !face.normal) return null;

  const basis = computePlaneBasis(face.normal, contour[0]);
  const to2d = (p) => projectPointTo2d(p, basis);
  const loops2d = [
    contour.map(to2d),
    ...(face.holes || [])
      .filter((hole) => hole?.length >= 3)
      .map((hole) => hole.map(to2d)),
  ];

  const chunks = [];
  for (const line of cutLines || []) {
    for (const run of splitLineByPlane(line, basis, planeTolerance)) {
      // A run end where the line LEAVES the plane (it climbs a wall standing
      // on this face) is prolonged along its last segment up to the face
      // boundary — the face usually continues under the wall, so that end
      // sits strictly inside it and the cut would otherwise be dropped. A
      // run end that is the line's own end (a « Stop », a drawn end) is
      // left where it is.
      const path2d = extendContinuingEnds(
        loops2d,
        run.points.map(to2d),
        run,
        tolerance
      );
      const result = getPathChunksInRegion(loops2d, path2d, {
        tolerance,
        extendEnds: false,
      });
      if (result.error) continue;
      chunks.push(...result.chunks);
    }
  }
  if (!chunks.length) return null;

  const pieces2d = cutRegionByChunks(loops2d, chunks, tolerance);
  if (!pieces2d) return null;

  const pieces = pieces2d.map(({ contour: contour2d, holes: holes2d }) => ({
    contour: contour2d.map((p) => liftPointTo3d(p, basis)),
    holes: holes2d.map((hole) => hole.map((p) => liftPointTo3d(p, basis))),
    normal: { ...face.normal },
    area: polygonArea2d(contour2d, holes2d),
    centroid: liftPointTo3d(
      polygonCentroid2dWithHoles(contour2d, holes2d),
      basis
    ),
  }));

  let hitPieceIndex = -1;
  if (hitPoint) {
    const hit2d = to2d(hitPoint);
    hitPieceIndex = pieces2d.findIndex(
      ({ contour: contour2d, holes: holes2d }) =>
        pointInPolygon2d(hit2d, contour2d) &&
        !holes2d.some((hole) => pointInPolygon2d(hit2d, hole))
    );
  }

  return { pieces, hitPieceIndex, loops2d, basis };
}

// Maximal runs of consecutive points of the line lying on the plane:
// [{ points, continuesBefore, continuesAfter }] — the flags tell whether the
// line goes on off the plane before / after the run.
function splitLineByPlane(line, basis, planeTolerance) {
  const points = (line || []).filter(
    (p) =>
      Number.isFinite(p?.x) && Number.isFinite(p?.y) && Number.isFinite(p?.z)
  );
  const onPlane = points.map(
    (p) => Math.abs(dot(sub(p, basis.origin), basis.n)) <= planeTolerance
  );
  const runs = [];
  let start = -1;
  const flush = (end) => {
    // run = points[start..end] (inclusive)
    if (start >= 0 && end - start + 1 >= 2) {
      runs.push({
        points: points.slice(start, end + 1),
        continuesBefore: start > 0,
        continuesAfter: end < points.length - 1,
      });
    }
    start = -1;
  };
  for (let i = 0; i < points.length; i++) {
    if (onPlane[i]) {
      if (start < 0) start = i;
      continue;
    }
    flush(i - 1);
  }
  flush(points.length - 1);
  return runs;
}

// The 2D path of a run with each end that continues off the plane
// prolonged along its end segment to the first boundary ahead, when that
// end lies strictly inside the region. Ends on the boundary (or outside)
// are untouched.
function extendContinuingEnds(loops, path, run, tolerance) {
  const out = path.map((p) => ({ x: p.x, y: p.y }));
  const n = out.length;
  if (n < 2) return out;
  const strictlyInside = (p) =>
    isInsideRegion(loops, p) && distanceToBoundary(loops, p) > tolerance;
  if (run.continuesBefore && strictlyInside(out[0])) {
    const hit = castRayToBoundary(loops, out[1], out[0]);
    if (hit) out[0] = hit;
  }
  if (run.continuesAfter && strictlyInside(out[n - 1])) {
    const hit = castRayToBoundary(loops, out[n - 2], out[n - 1]);
    if (hit) out[n - 1] = hit;
  }
  return out;
}

// First boundary point on the ray from `end` going away from `from`.
function castRayToBoundary(loops, from, end) {
  const dx = end.x - from.x;
  const dy = end.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return null;
  const ux = dx / len;
  const uy = dy / len;
  let best = null;
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i++) {
      const c = loop[i];
      const d = loop[(i + 1) % loop.length];
      const sx = d.x - c.x;
      const sy = d.y - c.y;
      const denom = ux * sy - uy * sx;
      if (Math.abs(denom) < 1e-15) continue;
      const t = ((c.x - end.x) * sy - (c.y - end.y) * sx) / denom;
      const v = ((c.x - end.x) * uy - (c.y - end.y) * ux) / denom;
      if (t <= 1e-9 || v < -1e-9 || v > 1 + 1e-9) continue;
      if (!best || t < best) best = t;
    }
  }
  if (best === null) return null;
  return { x: end.x + best * ux, y: end.y + best * uy };
}

// Draws the chunks one after the other on the region: each chunk is clipped
// to every current piece and cuts the pieces it crosses. The face splitter
// behind splitFlatRegionAlongChunks cuts one face per path, so a chunk
// crossing an earlier cut has to be applied piece by piece.
// Returns [{ contour, holes }] (2D) or null when nothing was cut.
function cutRegionByChunks(loops2d, chunks, tolerance) {
  let pieces = [{ contour: loops2d[0], holes: loops2d.slice(1) }];
  let cut = false;
  for (const chunk of chunks) {
    const next = [];
    for (const piece of pieces) {
      const loops = [piece.contour, ...piece.holes];
      const result = getPathChunksInRegion(loops, chunk, {
        tolerance,
        extendEnds: false,
      });
      const split = result.error
        ? null
        : splitFlatRegionAlongChunks(loops, result.chunks);
      if (!split) {
        next.push(piece);
        continue;
      }
      cut = true;
      for (const face of split.faces) {
        next.push({
          contour: face.loop.map((i) => split.vertices[i]),
          holes: (face.holes || []).map((hole) =>
            hole.map((i) => split.vertices[i])
          ),
        });
      }
    }
    pieces = next;
  }
  return cut ? pieces : null;
}

// Area-weighted centroid of a 2D polygon with holes.
function polygonCentroid2dWithHoles(contour, holes) {
  const contourArea = Math.abs(signedArea2d(contour));
  const c = polygonCentroid2d(contour);
  let weight = contourArea;
  let x = c.x * contourArea;
  let y = c.y * contourArea;
  for (const hole of holes) {
    const area = Math.abs(signedArea2d(hole));
    const h = polygonCentroid2d(hole);
    weight -= area;
    x -= h.x * area;
    y -= h.y * area;
  }
  if (Math.abs(weight) < 1e-12) return c;
  return { x: x / weight, y: y / weight };
}
