import getAnnotationQties from "./getAnnotationQties";

// Reuse the main quantity calculator on a synthesized "virtual" annotation
// matching the geometry of the selected part. Keeps arc handling, units,
// and disabled-state semantics consistent with the whole-annotation case.
export default function getAnnotationPartQties({ annotation, part, meterByPx }) {
  if (!part || part.kind === "NONE" || !annotation) return null;
  if (!meterByPx || !Number.isFinite(meterByPx) || meterByPx <= 0) {
    return { enabled: false };
  }

  const kind = part.kind;

  if (kind === "POINT") {
    return { enabled: false };
  }

  if (kind === "SEGMENT" || kind === "SEGMENTS" || kind === "CUT_SEG" || kind === "GUIDE") {
    // For SEGMENTS, always sum across chains so closed-ring chains contribute
    // their wraparound segment (chain.closesRing → closeLine on the temp
    // polyline used for qty computation). Single-chain selections also flow
    // through this path so the closing segment is counted when applicable.
    if (kind === "SEGMENTS" && Array.isArray(part.chains) && part.chains.length > 0) {
      let total = 0;
      for (const chain of part.chains) {
        const pts = chain?.pointRefs || [];
        if (pts.length < 2) continue;
        const q = getAnnotationQties({
          annotation: {
            type: "POLYLINE",
            points: pts,
            closeLine: !!chain.closesRing,
          },
          meterByPx,
        });
        total += q?.length || 0;
      }
      return { enabled: true, length: total, surface: 0 };
    }
    const points = part.geometryPx || [];
    if (points.length < 2) return null;
    return getAnnotationQties({
      annotation: { type: "POLYLINE", points, closeLine: false },
      meterByPx,
    });
  }

  if (kind === "CUT") {
    const points = part.geometryPx || [];
    if (points.length < 3) return null;
    return getAnnotationQties({
      annotation: { type: "POLYGON", points },
      meterByPx,
    });
  }

  return null;
}
