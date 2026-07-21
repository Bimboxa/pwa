import partitionPolygonByChords from "./partitionPolygonByChords";

// Historical iso-height entry point, now a thin adapter over the generalized
// chord partition (partitionPolygonByChords). An iso chord is a chord whose
// vertices all carry the SAME height and whose endpoints PIN the contour
// vertices they land on (inheritEndpoints=false).
//
// Inputs (2D units of the caller — basemap-local for 3D, pixels for qties):
//   - contour: outer ring [{x, y, offsetBottom?, offsetTop?}, ...]
//     (arc-expanded; offsets in meters, already baked by
//     applyIsoHeightLinesToRings for non-iso vertices)
//   - holes: cut rings (same shape)
//   - isoChords: [{ polyline: [{x,y}, ...], height }] — height in meters
//     (offsetTop semantics)
//
// Returns { augContour, augHoles, extraPoints, tris } or null (fallback to
// the interpolated-height triangulation) — see partitionPolygonByChords.
export default function partitionPolygonByIsoLines({
  contour,
  holes = [],
  isoChords = [],
}) {
  const chords = (isoChords || [])
    .map((c) => {
      const height = Number(c?.height) || 0;
      return {
        polyline: (c?.polyline || []).map((p) => ({
          x: p?.x,
          y: p?.y,
          height,
        })),
        inheritEndpoints: false,
      };
    })
    .filter((c) => c.polyline.length >= 2);
  if (chords.length === 0) return null;

  return partitionPolygonByChords({ contour, holes, chords });
}
