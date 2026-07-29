import { expandArcsInPath } from "Features/geometry/utils/arcSampling";
import projectPointOnPolyline from "Features/annotations/utils/projectPointOnPolyline";
import getPolylineMidpoint from "Features/geometry/utils/getPolylineMidpoint";
import slideProfileLineAlongGuide from "Features/elevation/utils/slideProfileLineAlongGuide";

// MUST match slideProfileLineAlongGuide, so the ownership scan below picks the
// same crossing the slide anchors on, and a midpoint computed on the expanded
// chain projects back onto it at ~zero distance.
const GUIDE_ARC_SAMPLES = 16;

// Endpoint-inclusive segment-segment crossing — same predicate as the anchor
// scan in slideProfileLineAlongGuide.
function segmentsCross(a, b, c, d) {
  const rX = b.x - a.x;
  const rY = b.y - a.y;
  const sX = d.x - c.x;
  const sY = d.y - c.y;
  const denom = rX * sY - rY * sX;
  if (Math.abs(denom) < 1e-12) return false;
  const acX = c.x - a.x;
  const acY = c.y - a.y;
  const t = (acX * sY - acY * sX) / denom;
  const u = (acX * rY - acY * rX) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function nearestDistance(profilePx, expandedPiece) {
  let best = Infinity;
  for (const p of profilePx) {
    const proj = projectPointOnPolyline(p, expandedPiece);
    if (proj && proj.distance < best) best = proj.distance;
  }
  return best;
}

/**
 * Partition annotation.profileLines between the two pieces of an
 * open-polyline split. Per line: the piece the profile geometrically crosses
 * (fallback: nearest; tie: piece1) keeps the ORIGINAL line refs; the other
 * piece receives a duplicate with fresh point ids, slid to the arc-length
 * middle of its chain (drag-along-guide semantics). Point ids are never
 * shared between the two pieces on any path.
 *
 * Everything is PIXEL space; the caller owns all db writes.
 *
 * @param {Array} profileLines raw refs [{points: [{pointId, type?, height?}], ...lineFields}]
 * @param {Array} piece1Px piece1 chain px [{x, y, type?}] (shared cut vertex last)
 * @param {Array} piece2Px piece2 chain px [{x, y, type?}] (shared cut vertex first)
 * @param {Object} profilePxById pointId → {x, y} px
 * @param {Function} makeId () => new point id
 * @returns {{piece1ProfileLines: Array, piece2ProfileLines: Array, newPoints: Array}}
 *   newPoints = [{id, x, y}] px rows to persist.
 */
export default function partitionProfileLinesOnSplit({
  profileLines,
  piece1Px,
  piece2Px,
  profilePxById,
  makeId,
}) {
  const piece1ProfileLines = [];
  const piece2ProfileLines = [];
  const newPoints = [];

  const lines = Array.isArray(profileLines) ? profileLines : [];
  if (lines.length === 0)
    return { piece1ProfileLines, piece2ProfileLines, newPoints };

  // The cut lands on a square anchor, so arc expansion is concatenative:
  // expanded(full) = expanded(piece1) ++ expanded(piece2) (shared vertex once)
  // and expanded segment index < k1 - 1 ⇔ the segment belongs to piece1.
  const fullPx = [...piece1Px, ...piece2Px.slice(1)];
  const expandedFull = expandArcsInPath(fullPx, GUIDE_ARC_SAMPLES, false);
  const expandedPiece1 = expandArcsInPath(piece1Px, GUIDE_ARC_SAMPLES, false);
  const expandedPiece2 = expandArcsInPath(piece2Px, GUIDE_ARC_SAMPLES, false);
  const k1 = expandedPiece1.length;

  lines.forEach((line) => {
    const refs = (line?.points ?? []).filter((r) => {
      const px = r?.pointId ? profilePxById[r.pointId] : null;
      return px && Number.isFinite(px.x) && Number.isFinite(px.y);
    });
    if (refs.length < 2) {
      // Unresolvable line: keep it on piece1 verbatim, no duplicate.
      piece1ProfileLines.push(line);
      return;
    }
    const profilePx = refs.map((r) => profilePxById[r.pointId]);

    // Ownership: first crossing in guide order (the crossing the slide
    // anchors on). A profile through the shared cut vertex hits piece1's
    // last expanded segment first → owner piece1, deterministically.
    let ownerIsPiece1 = null;
    for (let i = 0; i < expandedFull.length - 1; i += 1) {
      let hit = false;
      for (let j = 0; j < profilePx.length - 1; j += 1) {
        if (
          segmentsCross(
            expandedFull[i],
            expandedFull[i + 1],
            profilePx[j],
            profilePx[j + 1]
          )
        ) {
          hit = true;
          break;
        }
      }
      if (hit) {
        ownerIsPiece1 = i < k1 - 1;
        break;
      }
    }
    if (ownerIsPiece1 == null) {
      const d1 = nearestDistance(profilePx, expandedPiece1);
      const d2 = nearestDistance(profilePx, expandedPiece2);
      ownerIsPiece1 = d1 <= d2;
    }

    const ownerList = ownerIsPiece1 ? piece1ProfileLines : piece2ProfileLines;
    const otherList = ownerIsPiece1 ? piece2ProfileLines : piece1ProfileLines;
    const receivingPx = ownerIsPiece1 ? piece2Px : piece1Px;

    ownerList.push(line);

    // Duplicate slid to the middle of the receiving piece. The FULL chain is
    // the guide so C0/offsets come from the profile's true crossing, while
    // the projected midpoint lands on the receiving piece with its local
    // normal — exact drag semantics.
    const mid = getPolylineMidpoint(receivingPx, GUIDE_ARC_SAMPLES);
    let newPositions = mid
      ? slideProfileLineAlongGuide({
          guidePoints: fullPx,
          closeLine: false,
          profilePoints: profilePx,
          targetPos: mid,
        })
      : null;
    if (!newPositions || newPositions.length !== refs.length) {
      // Degenerate: duplicate at the original coordinates (fresh ids).
      newPositions = profilePx;
    }

    const dupRefs = refs.map((r, i) => {
      const id = makeId();
      newPoints.push({ id, x: newPositions[i].x, y: newPositions[i].y });
      return {
        pointId: id,
        ...(r.type ? { type: r.type } : {}),
        ...(typeof r.height === "number" ? { height: r.height } : {}),
      };
    });
    otherList.push({ ...line, points: dupRefs });
  });

  return { piece1ProfileLines, piece2ProfileLines, newPoints };
}
