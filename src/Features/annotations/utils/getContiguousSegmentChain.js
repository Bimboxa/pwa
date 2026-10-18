// Decode a part id of the form:
//   "{annotationId}::SEG::{segIdx}"            (main ring segment)
//   "{annotationId}::CUT_SEG::{cutIdx}::{segIdx}"  (cut ring segment)
// Returns { ringKey, segIdx } where ringKey is "MAIN" or `CUT::${cutIdx}`.
function decodePartId(partId) {
  if (!partId || typeof partId !== "string") return null;
  const parts = partId.split("::");
  if (parts.length < 3) return null;
  const partType = parts[1];
  if (partType === "SEG") {
    const segIdx = Number(parts[2]);
    if (!Number.isFinite(segIdx)) return null;
    return { ringKey: "MAIN", segIdx };
  }
  if (partType === "CUT_SEG") {
    if (parts.length < 4) return null;
    const cutIdx = Number(parts[2]);
    const segIdx = Number(parts[3]);
    if (!Number.isFinite(cutIdx) || !Number.isFinite(segIdx)) return null;
    return { ringKey: `CUT::${cutIdx}`, segIdx };
  }
  return null;
}

// Given an annotation and a set of selected segment partIds, validate that
// they form a single contiguous chain on the same ring and return the
// ordered list of point refs spanning the chain.
//
//   - 1 segment idx=i → [points[i], points[i+1]]
//   - N contiguous segments i, i+1, …, i+N-1 → N+1 points
//
// Returns { contiguous: bool, ringKey, pointRefs?: [{id, ...}] }.
//
// On closed rings (POLYGON main contour, polyline with `closeLine`, every
// cut) the last segment (N-1 → 0) is a valid segment: its end point is taken
// modulo N. A selection whose sorted indices straddle the seam ([N-1, 0]) is
// still reported non-contiguous here — the multi-segment path goes through
// getContiguousSegmentChains, which handles the wraparound.
export default function getContiguousSegmentChain(annotation, partIds) {
  if (!annotation || !Array.isArray(partIds) || partIds.length === 0) {
    return { contiguous: false };
  }

  const decoded = partIds.map(decodePartId).filter(Boolean);
  if (decoded.length !== partIds.length) return { contiguous: false };

  const ringKey = decoded[0].ringKey;
  if (!decoded.every((d) => d.ringKey === ringKey)) {
    return { contiguous: false };
  }

  const sorted = [...decoded].sort((a, b) => a.segIdx - b.segIdx);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].segIdx !== sorted[i - 1].segIdx + 1) {
      return { contiguous: false, ringKey };
    }
  }

  let ringPoints;
  let isClosed;
  if (ringKey === "MAIN") {
    ringPoints = annotation.points || [];
    isClosed = annotation.type === "POLYGON" || annotation.closeLine === true;
  } else {
    const cutIdx = Number(ringKey.split("::")[1]);
    ringPoints = annotation.cuts?.[cutIdx]?.points || [];
    isClosed = true; // cuts are always closed rings
  }
  const N = ringPoints.length;
  if (N < 2) return { contiguous: false, ringKey };

  const startIdx = sorted[0].segIdx;
  const lastSegIdx = sorted[sorted.length - 1].segIdx;
  // Segment i spans points[i] → points[(i+1) % N]; on an open ring the last
  // valid segment is N-2, on a closed ring it is N-1 (the seam).
  const maxSegIdx = isClosed ? N - 1 : N - 2;
  if (startIdx < 0 || lastSegIdx > maxSegIdx) {
    return { contiguous: false, ringKey };
  }

  const pointRefs = [ringPoints[startIdx]];
  for (const { segIdx } of sorted) pointRefs.push(ringPoints[(segIdx + 1) % N]);
  return {
    contiguous: true,
    ringKey,
    pointRefs,
    startSegIdx: startIdx,
    endSegIdx: lastSegIdx,
  };
}

// Same input as getContiguousSegmentChain, but returns every contiguous chain
// found in the selection — one chain per group of consecutive segIdx on the
// same ring. Useful for batch-cloning a non-contiguous multi-segment selection
// into multiple polylines (one per chain).
//
// On closed rings (POLYGON main contour, polyline with `closeLine`, every cut),
// the algorithm:
//   - treats the wraparound segment (N-1 → 0) as adjacent to segment 0,
//     so a selection like [N-1, 0, 1] yields a single 3-segment chain;
//   - flags chains that cover the entire ring with `closesRing: true` and
//     emits the N original point refs (no duplicated start point) so the
//     clone hook can set `closeLine: true` on the resulting polyline.
//
// Returns: [{ ringKey, pointRefs, startSegIdx, endSegIdx, closesRing }, ...]
export function getContiguousSegmentChains(annotation, partIds) {
  if (!annotation || !Array.isArray(partIds) || partIds.length === 0) return [];

  // Group by ring
  const perRing = new Map();
  for (const id of partIds) {
    const d = decodePartId(id);
    if (!d) continue;
    if (!perRing.has(d.ringKey)) perRing.set(d.ringKey, []);
    perRing.get(d.ringKey).push(d.segIdx);
  }

  const isMainClosed =
    annotation.type === "POLYGON" || annotation.closeLine === true;

  const chains = [];
  for (const [ringKey, segIdxs] of perRing.entries()) {
    let ringPoints;
    let isClosed;
    if (ringKey === "MAIN") {
      ringPoints = annotation.points || [];
      isClosed = isMainClosed;
    } else {
      const cutIdx = Number(ringKey.split("::")[1]);
      ringPoints = annotation.cuts?.[cutIdx]?.points || [];
      isClosed = true; // cuts are always closed rings
    }
    if (ringPoints.length < 2) continue;

    const N = ringPoints.length;
    const uniqueSorted = [...new Set(segIdxs)].sort((a, b) => a - b);
    const segSet = new Set(uniqueSorted);

    if (isClosed) {
      // Whole ring covered → emit a single closed chain.
      if (uniqueSorted.length === N) {
        chains.push({
          ringKey,
          pointRefs: ringPoints,
          startSegIdx: 0,
          endSegIdx: N - 1,
          closesRing: true,
        });
        continue;
      }
      // Find each "chain start": a selected segIdx whose circular predecessor
      // is NOT selected. Walk forward to collect the consecutive run.
      const visited = new Set();
      for (const start of uniqueSorted) {
        if (visited.has(start)) continue;
        const prev = (start - 1 + N) % N;
        if (segSet.has(prev)) continue; // not a chain start
        const runSegs = [];
        let cur = start;
        while (segSet.has(cur) && !visited.has(cur)) {
          runSegs.push(cur);
          visited.add(cur);
          cur = (cur + 1) % N;
        }
        // segIdx i means segment points[i] → points[(i+1)%N], so the chain
        // has K+1 points where K is its segment count.
        const refs = [ringPoints[runSegs[0]]];
        for (const s of runSegs) refs.push(ringPoints[(s + 1) % N]);
        chains.push({
          ringKey,
          pointRefs: refs,
          startSegIdx: runSegs[0],
          endSegIdx: runSegs[runSegs.length - 1],
          closesRing: false,
        });
      }
      continue;
    }

    // Open ring — linear contiguity.
    let runStart = uniqueSorted[0];
    let runEnd = uniqueSorted[0];
    for (let i = 1; i <= uniqueSorted.length; i++) {
      const next = uniqueSorted[i];
      if (next === runEnd + 1) {
        runEnd = next;
        continue;
      }
      if (runEnd + 1 <= N) {
        chains.push({
          ringKey,
          pointRefs: ringPoints.slice(runStart, runEnd + 2),
          startSegIdx: runStart,
          endSegIdx: runEnd,
          closesRing: false,
        });
      }
      runStart = next;
      runEnd = next;
    }
  }
  return chains;
}

export { decodePartId };
