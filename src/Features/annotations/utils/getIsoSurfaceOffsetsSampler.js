import partitionPolygonByIsoLines from "Features/geometry/utils/partitionPolygonByIsoLines";
import { createTopSurfaceSampler } from "Features/geometry/utils/carveHolesInTopMesh";
import {
  expandRingWithOffsets,
  adaptiveArcSamples,
} from "Features/geometry/utils/arcSampling";

// Sampler of the top surface of a POLYGON folded on its isoHeightLines, cuts
// ignored (the sheet as if the polygon had no hole): (p) => { offsetBottom,
// offsetTop } at a pixel position. Used to give a vertex created on that
// surface (contour notch of "Evider") the height the sheet has there.
//
// `annotation` is the pixel-resolved POLYGON (useAnnotationsV2). Returns null
// when the annotation has no iso line, carries profileLines (the shell drives
// the surface) or when the strict partition does not apply. `extrapolate`:
// a position outside the polygon extends the plane of the closest face.
export default function getIsoSurfaceOffsetsSampler(
  annotation,
  { extrapolate = false } = {}
) {
  if (annotation?.profileLines?.some((l) => l?.points?.length >= 2)) {
    return null;
  }
  const isoChords = (annotation?.isoHeightLines || [])
    .filter((l) => l?.points?.length >= 2)
    .map((l) => ({
      polyline: (l.points || [])
        .filter((p) => typeof p?.x === "number" && typeof p?.y === "number")
        .map((p) => ({ x: p.x, y: p.y })),
      height: Number(l?.height) || 0,
    }));
  if (isoChords.length === 0) return null;

  const points = (annotation?.points || []).filter(
    (p) => typeof p?.x === "number" && typeof p?.y === "number"
  );
  if (points.length < 3) return null;

  const part = partitionPolygonByIsoLines({
    contour: expandRingWithOffsets(points, adaptiveArcSamples, true),
    holes: [],
    isoChords,
  });
  if (!part) return null;

  return createTopSurfaceSampler({
    flatPts: [...part.augContour, ...part.extraPoints],
    tris: part.tris,
    extrapolate,
  });
}
