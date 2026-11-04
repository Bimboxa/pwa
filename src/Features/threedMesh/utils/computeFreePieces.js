import { repairTJunctions } from "./coalesceCoplanarFaces.js";
import { COVER_NORMAL_DOT, COVER_PLANE_TOL_M } from "./mesh3dConstants.js";
import { projectPointTo2d } from "./planeProjection.js";
import {
  DEFAULT_WELD_GRID_M,
  createWelder,
  difference,
  multiPolygonBounds,
  ringsToMultiPolygon,
  unionAll,
} from "./polygonBoolean2d.js";
import { dot, normalize, sub } from "./vec3Utils.js";

// Free region of an unfolded group of pieces (unfoldPiecesAcrossCreases), in
// the 2D coordinates of the atlas — what a new maille may cover.
//
// Per piece:
// - border = the piece contour minus the footprint of the existing mailles
//   lying on its plane (coplanar faces, shell triangles): its edges are the
//   BORDERS a new maille leans on — the face edges and the cut lines (the
//   contour of the piece) and the existing mailles;
// - openings = the holes of the piece (the openings of the face — polygon
//   `cuts`): never a border, a maille spans them and keeps them as holes;
// - free = border − openings.
// The borders (resp. openings) of every piece are then united into the
// atlas' own `border` (resp. `openings`): the region the cell of the cursor
// is searched in, across the creases.
//
// Every point goes through one welder so the crease vertices of two
// neighbor pieces (the same world point through two rigid maps) coincide
// exactly, and the T-junctions are repaired before the booleans.
//
// pieces: [{ contour, holes, normal }] world; nodes: Map(pieceIndex → node);
// meshes3d: [{ faces: [{ contour, holes, normal }], shell: { positions } }].
//
// Returns { regions: [{ pieceIndex, border, openings, free, bounds }],
// border, openings } (MultiPolygons, see polygonBoolean2d) or null when a
// boolean fails. Pure (no three.js), node-testable.
export default function computeFreePieces({
  pieces,
  nodes,
  meshes3d,
  grid = DEFAULT_WELD_GRID_M,
}) {
  const weld = createWelder(grid);
  const faces = [];
  const shells = [];
  for (const mesh of meshes3d || []) {
    if (!mesh || mesh.deletedAt) continue;
    for (const face of mesh.faces || []) {
      if (face?.contour?.length >= 3 && face.normal) faces.push(face);
    }
    if (mesh.shell?.positions?.length >= 9) shells.push(mesh.shell.positions);
  }

  const allRings = [];
  const drafts = [];
  for (const node of nodes.values()) {
    const piece = pieces[node.pieceIndex];
    if (!piece?.contour || piece.contour.length < 3) continue;
    const n = normalize(piece.normal);
    const origin = node.basis.origin;
    const offPlane = (p) => Math.abs(dot(n, sub(p, origin)));
    const toRing = (loop) =>
      loop.map((p) => {
        const q = node.toAtlas(projectPointTo2d(p, node.basis));
        return weld(q.x, q.y);
      });
    const track = (ring) => {
      allRings.push(ring);
      return ring;
    };

    const contour = track(toRing(piece.contour));
    const holes = (piece.holes || [])
      .filter((hole) => hole?.length >= 3)
      .map((hole) => track(toRing(hole)));

    // Footprints of the existing mailles on this piece's plane.
    const footprints = [];
    for (const face of faces) {
      if (Math.abs(dot(n, normalize(face.normal))) < COVER_NORMAL_DOT) continue;
      if (face.contour.some((p) => offPlane(p) > COVER_PLANE_TOL_M)) continue;
      footprints.push([
        track(toRing(face.contour)),
        ...(face.holes || [])
          .filter((hole) => hole?.length >= 3)
          .map((hole) => track(toRing(hole))),
      ]);
    }
    for (const positions of shells) {
      for (let i = 0; i + 8 < positions.length; i += 9) {
        const a = { x: positions[i], y: positions[i + 1], z: positions[i + 2] };
        if (offPlane(a) > COVER_PLANE_TOL_M) continue;
        const b = {
          x: positions[i + 3],
          y: positions[i + 4],
          z: positions[i + 5],
        };
        if (offPlane(b) > COVER_PLANE_TOL_M) continue;
        const c = {
          x: positions[i + 6],
          y: positions[i + 7],
          z: positions[i + 8],
        };
        if (offPlane(c) > COVER_PLANE_TOL_M) continue;
        const ring = toRing([a, b, c]);
        if (ring[0] === ring[1] || ring[1] === ring[2] || ring[0] === ring[2])
          continue;
        footprints.push([track(ring)]);
      }
    }
    drafts.push({ pieceIndex: node.pieceIndex, contour, holes, footprints });
  }

  repairTJunctions(allRings, grid * 1.5);

  const regions = [];
  for (const draft of drafts) {
    const covered = unionAll(
      draft.footprints.map((rings) => ringsToMultiPolygon(rings))
    );
    if (!covered) return null;
    const border = difference(ringsToMultiPolygon([draft.contour]), covered);
    if (!border) return null;
    const openings = unionAll(
      draft.holes.map((hole) => ringsToMultiPolygon([hole]))
    );
    if (!openings) return null;
    const free = difference(border, openings);
    if (!free) return null;
    regions.push({
      pieceIndex: draft.pieceIndex,
      border,
      openings,
      free,
      bounds: multiPolygonBounds(free),
    });
  }

  const border = unionAll(regions.map((region) => region.border));
  const openings = unionAll(regions.map((region) => region.openings));
  if (!border || !openings) return null;
  return { regions, border, openings };
}
