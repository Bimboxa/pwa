import { Matrix4, Vector3 } from "three";

import {
  DEFAULT_FACE_ANGLE_DEG,
  getFaceRegion,
} from "Features/threedEditor/js/utilsAnnotationsManager/faceHoverHighlight";

// The FACE of a surface host under a triangle: the region the hover stipples
// (getFaceRegion — facets joined within the face selection angle; plane
// mode on a carved host, like the hover). Returns { seedTri, regionId, tris }
// or null. seedTri is what the part id stores: the region's id (its min
// triangle index, a member of the region, so seeding from it gives the same
// region back) in angle mode, the hit triangle in plane mode (a string id).
export function getSurfaceFaceAtTriangle(mesh, faceIndex, angleDeg) {
  const region = getFaceRegion(mesh?.geometry, faceIndex, {
    plane: !!mesh?.userData?.hasSubtraction,
    angleDeg: angleDeg ?? DEFAULT_FACE_ANGLE_DEG,
  });
  if (!region) return null;
  const seedTri = Number.isInteger(region.regionId)
    ? region.regionId
    : faceIndex;
  return { seedTri, regionId: region.regionId, tris: region.tris };
}

// Display → real surface factor of a piece mesh: a revolution shown as a
// display-only half-view (createAnnotationObject3D, isRevolutionHalfView)
// is the full turn in reality — the selected face is the whole band, its
// quantity too.
export function getSurfacePieceDisplayFactor(mesh) {
  const data = mesh?.userData;
  if (!data?.isRevolutionHalfView) return 1;
  const turn = data.revolutionHalfViewTurn;
  return turn > 0 && turn < 1 ? 1 / turn : 2;
}

// Matrix of `object` relative to `root` (local matrices walked: the root is
// an identity child of the base map group, whose frame is in meters).
function getMatrixRelativeTo(object, root) {
  const matrix = new Matrix4();
  let current = object;
  while (current && current !== root) {
    current.updateMatrix();
    matrix.premultiply(current.matrix);
    current = current.parent;
  }
  return matrix;
}

// Area (m², root frame) of the triangles `tris` of `mesh` — all of them
// when null.
export function getSurfaceTrianglesSurfaceM2(mesh, tris, root) {
  const position = mesh?.geometry?.getAttribute?.("position");
  if (!position) return 0;
  const index = mesh.geometry.getIndex();
  const count = Math.floor((index ? index.count : position.count) / 3);
  const matrix = getMatrixRelativeTo(mesh, root);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const at = (t, k) => (index ? index.getX(3 * t + k) : 3 * t + k);
  let total = 0;
  const list = tris ?? Array.from({ length: count }, (_, t) => t);
  for (const t of list) {
    if (!(t >= 0 && t < count)) continue;
    a.fromBufferAttribute(position, at(t, 0)).applyMatrix4(matrix);
    b.fromBufferAttribute(position, at(t, 1)).applyMatrix4(matrix);
    c.fromBufferAttribute(position, at(t, 2)).applyMatrix4(matrix);
    total += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return total;
}

const triCountOf = (mesh) => {
  const position = mesh?.geometry?.getAttribute?.("position");
  if (!position) return 0;
  const index = mesh.geometry.getIndex();
  return Math.floor((index ? index.count : position.count) / 3);
};

// Resolves the selected faces of a surface host (parts of surfacePieceParts)
// against the displayed object:
//
//   [{ part, mesh, regionId, tris, surface, isWholePiece }]
//
// tris: the face's triangles (null = the whole piece, a seedless part);
// surface: m², real (half-view factor applied); isWholePiece: the face
// covers its piece mesh — only such a face can be deleted (REMOVE entry of
// surfaceCuts drops a whole piece). A part whose piece or region is not
// displayed (rebuild, angle change) is left out.
export default function resolveSurfaceFaceParts({
  editor,
  annotationId,
  parts,
  angleDeg,
}) {
  const root =
    editor?.sceneManager?.annotationsManager?.annotationsObjectsMap?.[
      annotationId
    ];
  if (!root || !parts?.length) return [];
  const meshByPiece = new Map();
  root.traverse((child) => {
    if (child.isMesh && Number.isInteger(child.userData?.surfaceCutPiece)) {
      meshByPiece.set(child.userData.surfaceCutPiece, child);
    }
  });
  const out = [];
  for (const part of parts) {
    const mesh = meshByPiece.get(part.pieceIndex);
    if (!mesh) continue;
    const factor = getSurfacePieceDisplayFactor(mesh);
    if (part.seedTri === null) {
      const stored = mesh.userData.surfaceCutPieceSurface;
      const displayed = Number.isFinite(stored)
        ? stored
        : getSurfaceTrianglesSurfaceM2(mesh, null, root);
      out.push({
        part,
        mesh,
        regionId: null,
        tris: null,
        surface: displayed * factor,
        isWholePiece: true,
      });
      continue;
    }
    const face = getSurfaceFaceAtTriangle(mesh, part.seedTri, angleDeg);
    if (!face) continue;
    out.push({
      part,
      mesh,
      regionId: face.regionId,
      tris: face.tris,
      surface: getSurfaceTrianglesSurfaceM2(mesh, face.tris, root) * factor,
      isWholePiece: face.tris.length >= triCountOf(mesh),
    });
  }
  return out;
}
