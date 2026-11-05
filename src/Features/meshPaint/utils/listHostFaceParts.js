import { dot } from "../../threedMesh/utils/vec3Utils.js";
import {
  BRUSH_FACE_ANGLE_DEG,
  MATCH_ANGLE_DEG,
  MATCH_PLANE_GAP_M,
} from "../constants/meshPaintConstants.js";

import {
  faceOverlapAreaByFacet,
  flipFace,
  orientFaceLoops,
} from "./meshPaintGeometry.js";

// Every paintable FACE part of ONE host (buildHostPartIndex), as the
// « Pinceau » would pick them one click at a time — the parts of « Peindre
// toutes les faces de l'annotation »:
//
// - one part per planar facet (island), or per smooth surface when
//   smoothAngleDeg (« Sélection de face ») joins neighboring facets
//   (index.getSurfaces): a curved LocalFace, like a single click grows;
// - ONE side per facet, never both:
//   - closed host (solid): the outward side (the islands' own normals);
//   - open host (sheet, thin wall, open mesh): the side of the clicked face,
//     spread over the sheet it belongs to (the consistent orientation of
//     index.getSurfaces(180): the whole connected sheet); a sheet the clicked
//     face is not part of is turned toward the viewer (against `viewDir`).
//
// Pure: node-testable, relative imports only.

const COS_MATCH = Math.cos((MATCH_ANGLE_DEG * Math.PI) / 180);
const OVERLAP_OPTIONS = { cosMin: COS_MATCH, maxGap: MATCH_PLANE_GAP_M };

const toFace = (island) => ({
  polygons: island.polygons,
  normal: island.normal,
});

// The island the clicked face sits on (largest shared area, either side) and
// whether the clicked side is the island's other side.
function locateClickedIsland(islands, clickedFace) {
  let best = { island: -1, flipped: false, overlap: 0 };
  if (!clickedFace?.polygons?.length) return best;
  const clickedOtherSide = flipFace(clickedFace);
  islands.forEach((island, i) => {
    const face = toFace(island);
    const same = faceOverlapAreaByFacet(clickedFace, face, OVERLAP_OPTIONS);
    const other = faceOverlapAreaByFacet(
      clickedOtherSide,
      face,
      OVERLAP_OPTIONS
    );
    const overlap = Math.max(same, other);
    if (overlap > best.overlap) {
      best = { island: i, flipped: other > same, overlap };
    }
  });
  return best;
}

// Islands to flip so that every sheet of an open host shows one side.
function getOpenHostFlips(index, clicked, viewDir) {
  const { islands } = index;
  const { surfaces: sheets, flipOfIsland } = index.getSurfaces(180);
  const flips = new Array(islands.length).fill(false);
  for (const sheet of sheets) {
    let sheetFlip = false;
    if (clicked.island >= 0 && sheet.includes(clicked.island)) {
      sheetFlip = clicked.flipped !== Boolean(flipOfIsland[clicked.island]);
    } else if (viewDir) {
      // Area-weighted: most of the sheet faces the viewer.
      let facing = 0;
      for (const i of sheet) {
        const sign = flipOfIsland[i] ? -1 : 1;
        facing -= sign * islands[i].area * dot(islands[i].normal, viewDir);
      }
      sheetFlip = facing < 0;
    }
    for (const i of sheet) flips[i] = sheetFlip !== Boolean(flipOfIsland[i]);
  }
  return flips;
}

/**
 * @param {object} index - buildHostPartIndex result
 * @param {object} [options]
 * @param {number} [options.smoothAngleDeg] - « Sélection de face » angle:
 *   facets folding by less are one (curved) part; 0 = planar facets only
 * @param {object} [options.clickedFace] - LocalFace of the clicked part
 *   (planar or curved, same local frame): names the clicked part and, on an
 *   open host, the painted side
 * @param {{x, y, z}} [options.viewDir] - unit direction of the click ray
 *   (same frame): open sheets the clicked face is not part of face it
 * @param {number} [options.maxParts] - above this many parts nothing is
 *   listed (`tooMany`): a dense host is refused before any costly work
 * @returns {{parts: object[], clickedIndex: number, isClosed: boolean,
 *   tooMany: boolean}} parts: LocalFaces; clickedIndex: the part holding the
 *   clicked face (-1 when not found)
 */
export default function listHostFaceParts(
  index,
  {
    smoothAngleDeg = 0,
    clickedFace = null,
    viewDir = null,
    maxParts = Infinity,
  } = {}
) {
  const islands = index?.islands || [];
  const isClosed = Boolean(index?.isClosed);
  const none = { parts: [], clickedIndex: -1, isClosed, tooMany: false };
  if (!islands.length) return none;

  const angle =
    Number(smoothAngleDeg) > BRUSH_FACE_ANGLE_DEG ? Number(smoothAngleDeg) : 0;
  const { surfaces } = index.getSurfaces(angle);
  if (surfaces.length > maxParts) return { ...none, tooMany: true };

  const clicked = locateClickedIsland(islands, clickedFace);
  const flips = isClosed
    ? new Array(islands.length).fill(false)
    : getOpenHostFlips(index, clicked, viewDir);
  const oriented = (i) =>
    flips[i] ? flipFace(toFace(islands[i])) : toFace(islands[i]);

  const parts = [];
  let clickedIndex = -1;
  for (const surface of surfaces) {
    if (!surface.length) continue;
    const part =
      surface.length === 1
        ? oriented(surface[0])
        : orientFaceLoops({
            polygons: surface.flatMap((i) => oriented(i).polygons),
            curved: true,
            angleDeg: angle,
          });
    if (!part.polygons.length) continue;
    if (clicked.island >= 0 && surface.includes(clicked.island)) {
      clickedIndex = parts.length;
    }
    parts.push(part);
  }
  return { parts, clickedIndex, isClosed, tooMany: false };
}
