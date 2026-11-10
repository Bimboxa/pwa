import polygonClipping from "polygon-clipping";

// polygon-clipping ring ([[x, y], ...], closed by repeating its first point)
// -> annotation points [{x, y}].
function ringToPoints(ring) {
  const points = (ring ?? []).map(([x, y]) => ({ x, y }));
  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (first.x === last.x && first.y === last.y) points.pop();
  }
  return points;
}

function getRingArea(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

// MultiPolygon -> pieces [{points, cuts: [{points}]}], largest first (the
// shape PreviewHollowOutAnnotation draws).
export function multiPolygonToPieces(multiPolygon) {
  return (multiPolygon ?? [])
    .map((polygon) => {
      const [outer, ...holes] = polygon ?? [];
      const points = ringToPoints(outer);
      return {
        points,
        cuts: holes
          .map((hole) => ({ points: ringToPoints(hole) }))
          .filter((cut) => cut.points.length >= 3),
        area: getRingArea(points),
      };
    })
    .filter((piece) => piece.points.length >= 3)
    .sort((a, b) => b.area - a.area)
    .map(({ points, cuts }) => ({ points, cuts }));
}

/**
 * Preview of « Évider » in 3D: the projection of the host on its own base map
 * minus the footprints of its subtractions on that same base map. Pure 2D
 * boolean on polygon-clipping MultiPolygons, all in the host base map's
 * reference pixels.
 *
 * @param {Object} args
 * @param {Array|null} args.hostFootprint MultiPolygon of the host
 * @param {Array<Array|null>} args.cutterFootprints MultiPolygons to remove
 * @returns {{outline: Array, pieces: Array, consumed: boolean}|null} `outline`
 *   = the un-carved host pieces, `pieces` = what is left; null when the host
 *   casts no footprint (seen edge-on).
 */
export default function getHollowOut3dPreviewPieces({
  hostFootprint,
  cutterFootprints,
}) {
  const outline = multiPolygonToPieces(hostFootprint);
  if (outline.length === 0) return null;

  const cutters = (cutterFootprints ?? []).filter((f) => f?.length > 0);
  let carved = hostFootprint;
  if (cutters.length > 0) {
    try {
      carved = polygonClipping.difference(hostFootprint, ...cutters);
    } catch (e) {
      console.warn("[getHollowOut3dPreviewPieces] difference failed", e);
      carved = hostFootprint;
    }
  }
  const pieces = multiPolygonToPieces(carved);
  return { outline, pieces, consumed: pieces.length === 0 };
}
