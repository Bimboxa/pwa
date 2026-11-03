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
import getPathChunksInRegion from "../../surfaceCut/utils/getPathChunksInRegion.js";
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
  planeTolerance = 5e-3,
  tolerance = 1e-3,
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
      const result = getPathChunksInRegion(loops2d, run.map(to2d), {
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

// Maximal runs of consecutive points of the line lying on the plane.
function splitLineByPlane(line, basis, planeTolerance) {
  const runs = [];
  let current = [];
  for (const p of line || []) {
    const onPlane =
      Number.isFinite(p?.x) &&
      Number.isFinite(p?.y) &&
      Number.isFinite(p?.z) &&
      Math.abs(dot(sub(p, basis.origin), basis.n)) <= planeTolerance;
    if (onPlane) {
      current.push(p);
      continue;
    }
    if (current.length >= 2) runs.push(current);
    current = [];
  }
  if (current.length >= 2) runs.push(current);
  return runs;
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
