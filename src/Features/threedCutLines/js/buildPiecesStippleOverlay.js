import { buildStippleOverlayFromPositions } from "Features/threedEditor/js/utilsAnnotationsManager/faceHoverHighlight";

import triangulatePiece from "../utils/triangulatePiece";

// Hover stipple of a group of pieces of a region cut by the cut lines
// (clipRegionByCutLines): every piece triangulated in its own plane and
// lifted back to world coordinates — the overlay is added to the scene root.
// `style`: optional stipple style (default: the blue hover stipple).
// Null when every piece is degenerate.
export default function buildPiecesStippleOverlay(pieces, style) {
  const positions = [];
  for (const piece of pieces || []) positions.push(...triangulatePiece(piece));
  return positions.length
    ? buildStippleOverlayFromPositions(positions, style)
    : null;
}
