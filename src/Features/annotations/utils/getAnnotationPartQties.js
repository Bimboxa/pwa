import getAnnotationQties from "./getAnnotationQties";

// Resolve the ring length (N) and hidden-segment indices for the ring a chain
// belongs to, so hidden segments can be excluded from the measured length the
// same way the whole-annotation calculation does.
function ringHiddenInfo(annotation, chain) {
  if (!chain) return { n: 0, hidden: [] };
  if (chain.ringKey === "MAIN" || chain.ringKey == null) {
    return {
      n: (annotation.points || []).length,
      hidden: annotation.hiddenSegmentsIdx || [],
    };
  }
  const cutIdx = Number(String(chain.ringKey).split("::")[1]);
  const cut = annotation.cuts?.[cutIdx];
  return {
    n: (cut?.points || []).length,
    hidden: cut?.hiddenSegmentsIdx || [],
  };
}

// Map a chain's ring-level hidden segments to the local segment indices of the
// virtual polyline built from its pointRefs. Local segment j connects
// pointRefs[j] → pointRefs[j+1], i.e. ring segment (startSegIdx + j) % N.
function chainHiddenLocalIdx(annotation, chain) {
  const { n, hidden } = ringHiddenInfo(annotation, chain);
  if (!hidden.length || n <= 0) return [];
  const hiddenSet = new Set(hidden);
  const pts = chain?.pointRefs || [];
  const localSegCount = chain?.closesRing ? pts.length : pts.length - 1;
  const start = chain?.startSegIdx ?? 0;
  const local = [];
  for (let j = 0; j < localSegCount; j++) {
    if (hiddenSet.has((start + j) % n)) local.push(j);
  }
  return local;
}

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
            hiddenSegmentsIdx: chainHiddenLocalIdx(annotation, chain),
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
