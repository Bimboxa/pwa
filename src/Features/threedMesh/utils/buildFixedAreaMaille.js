import buildMeshDataFromPieces from "../../threedCutLines/utils/buildMeshDataFromPieces.js";
import coalesceCoplanarFaces, {
  COALESCE_NORMAL_TOL_RAD,
  COALESCE_PLANE_TOL_M,
} from "./coalesceCoplanarFaces.js";
import computeFreePieces from "./computeFreePieces.js";
import computeUserAxesFrame from "./computeUserAxesFrame.js";
import liftFixedAreaRect from "./liftFixedAreaRect.js";
import placeFixedAreaRect from "./placeFixedAreaRect.js";
import unfoldPiecesAcrossCreases from "./unfoldPiecesAcrossCreases.js";
import { dot, normalize, sub } from "./vec3Utils.js";

// « Ajouter une maille » with a target surface (Maillage CREATE tool): the
// maille pre-drawn under the cursor is a rectangle of that NET surface,
// aligned on the user axes of the « Repère », lying on the hovered group of
// pieces (clipRegionByCutLines) and leaning on its borders — the face edges,
// the cut lines and the existing mailles. Openings are spanned and kept as
// holes; a curved / faceted sheet is unfolded across its creases.
//
// Two steps, so the hover only pays the first one when the group, the
// mailles or the frame change:
//
// 1. prepareFixedAreaAtlas — unfolds the group from the hovered piece
//    (unfoldPiecesAcrossCreases, frame = computeUserAxesFrame on the root
//    piece) and computes its free region (computeFreePieces);
// 2. buildFixedAreaMaille — places the rectangle around the cursor
//    (placeFixedAreaRect), lifts it back on the pieces (liftFixedAreaRect)
//    and builds the maille data ({ faces } on one plane, { shell } across
//    creases).
//
// Pure (no three.js beyond triangulatePiece's ShapeUtils), node-testable.

// pieces / joins: clipRegionByCutLines' result; pieceIndices: the pieces of
// the hovered group; rootPieceIndex: the hovered piece; rootPoint: the
// hovered world point; axesDirs: [{ key, dir }] user axes (X, Y, Z);
// meshes3d: the existing maille records.
// Returns { pieces, nodes, regions, border, openings, frame } or null.
export function prepareFixedAreaAtlas({
  pieces,
  joins,
  pieceIndices,
  rootPieceIndex,
  rootPoint,
  axesDirs,
  meshes3d,
}) {
  const root = pieces?.[rootPieceIndex];
  if (!root?.contour?.length || !root.normal) return null;
  const frame = computeUserAxesFrame(
    root.normal,
    rootPoint ?? root.contour[0],
    axesDirs
  );
  const nodes = unfoldPiecesAcrossCreases({
    pieces,
    pieceIndices,
    joins,
    rootPieceIndex,
    frame,
    rootPoint,
  });
  if (!nodes.size) return null;
  const free = computeFreePieces({ pieces, nodes, meshes3d });
  if (!free) return null;
  return { pieces, nodes, frame, ...free };
}

// atlas: prepareFixedAreaAtlas' result; pieceIndex / cursorWorld: the
// hovered piece and point; targetArea (m²); snapToleranceM.
// Returns null (nothing to draw) or { placement, pieces, meshData, area,
// fits } — `pieces` world pieces for the overlay, `meshData` { faces } |
// { shell } for createMesh3dService (null when nothing can be built),
// `area` the net surface of the maille, `fits` false when the free cell is
// smaller than the target (the maille then fills the cell).
export default function buildFixedAreaMaille({
  atlas,
  pieceIndex,
  cursorWorld,
  targetArea,
  snapToleranceM = 0,
}) {
  const node = atlas?.nodes?.get(pieceIndex);
  if (!node || !cursorWorld) return null;
  const placement = placeFixedAreaRect({
    border: atlas.border,
    openings: atlas.openings,
    cursor2d: node.worldToAtlas(cursorWorld),
    targetArea,
    snapToleranceM,
  });
  if (!placement) return null;
  const lifted = liftFixedAreaRect({
    rect: placement.rect,
    regions: atlas.regions,
    nodes: atlas.nodes,
    pieces: atlas.pieces,
  });
  if (!lifted?.pieces.length) return null;
  return {
    placement,
    pieces: lifted.pieces,
    meshData: buildMeshData(lifted.pieces),
    area: lifted.area,
    fits: placement.fits,
  };
}

// One plane (even in several disjoint parts — an opening crossing the whole
// rectangle) → polygon faces; else the shell of buildMeshDataFromPieces.
function buildMeshData(pieces) {
  const n = normalize(pieces[0].normal);
  const origin = pieces[0].contour[0];
  const cosTol = Math.cos(COALESCE_NORMAL_TOL_RAD);
  const coplanar = pieces.every(
    (piece) =>
      dot(normalize(piece.normal), n) >= cosTol &&
      Math.abs(dot(n, sub(piece.contour[0], origin))) <= COALESCE_PLANE_TOL_M
  );
  if (coplanar) {
    return {
      faces: coalesceCoplanarFaces(
        pieces.map((piece) => ({
          contour: piece.contour,
          holes: piece.holes,
          normal: piece.normal,
        }))
      ),
    };
  }
  return buildMeshDataFromPieces(pieces);
}
