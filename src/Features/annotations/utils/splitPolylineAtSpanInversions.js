// Detects and resolves "span inversions" in a POLYLINE wall after a vertical
// move. With the wall convention top_z = verticalLift + height + offsetTop
// (i.e. the top no longer follows offsetBottom), a corner whose offsetBottom
// exceeds (height + offsetTop) has its bottom above its top — non-physical.
// We:
//   - split each segment crossing the inversion threshold by inserting a new
//     vertex at the linearly-interpolated point where span = 0 (knife edge);
//   - mark every now-negative segment as hidden (annotation.hiddenSegmentsIdx).
//
// The function is pure: it returns the new refs, the new hiddenSegmentsIdx
// and the list of new db.points records the caller must insert.
//
// Inputs:
//   - refs               : post-shift annotation.points (with up-to-date
//                          offsetBottom / offsetTop on each ref)
//   - height             : annotation.height (>= 0)
//   - closeLine          : annotation.closeLine (boolean)
//   - existingHiddenIdx  : current annotation.hiddenSegmentsIdx (array of ints)
//   - pointsById         : Map<id, {x, y}> — normalized [0..1] coords (POST-
//                          shift if XY was moved). Must cover every id in refs.
//   - newPointFactory    : (xNorm, yNorm) => { id, x, y, ...extra-fields },
//                          provided by the caller to inject annotation
//                          metadata (projectId / baseMapId / listingId) and
//                          mint the id.
//
// Outputs:
//   { refs, hiddenSegmentsIdx, pointsToAdd, changed }
//   - changed : true when any insertion or hiddenSegmentsIdx change occurred.
export default function splitPolylineAtSpanInversions({
  refs,
  height,
  closeLine,
  existingHiddenIdx,
  pointsById,
  newPointFactory,
}) {
  const N = (refs || []).length;
  if (N < 2 || !Number.isFinite(height)) {
    return {
      refs: refs || [],
      hiddenSegmentsIdx: existingHiddenIdx || [],
      pointsToAdd: [],
      changed: false,
    };
  }
  const spans = refs.map(
    (r) => height + (r?.offsetTop ?? 0) - (r?.offsetBottom ?? 0)
  );
  const oldHidden = new Set(existingHiddenIdx || []);

  const newRefs = [];
  const newHidden = [];
  const pointsToAdd = [];
  let newSegIdx = 0;
  let inserted = 0;

  const lastIdxToVisitSegment = closeLine ? N - 1 : N - 2;

  for (let i = 0; i < N; i++) {
    newRefs.push(refs[i]);
    if (i > lastIdxToVisitSegment) continue;
    const j = (i + 1) % N;
    const sa = spans[i];
    const sb = spans[j];
    const aOk = sa >= 0;
    const bOk = sb >= 0;
    const wasHidden = oldHidden.has(i);

    if (aOk && bOk) {
      if (wasHidden) newHidden.push(newSegIdx);
      newSegIdx += 1;
      continue;
    }
    if (!aOk && !bOk) {
      newHidden.push(newSegIdx);
      newSegIdx += 1;
      continue;
    }
    // Mixed signs → split at t where span = 0.
    const denom = sa - sb;
    if (Math.abs(denom) < 1e-12) {
      if (!aOk) newHidden.push(newSegIdx);
      else if (wasHidden) newHidden.push(newSegIdx);
      newSegIdx += 1;
      continue;
    }
    const t = sa / denom;
    if (!Number.isFinite(t) || t <= 0 || t >= 1) {
      // Numerical edge — treat as: if start is negative, hide; otherwise keep.
      if (!aOk) newHidden.push(newSegIdx);
      else if (wasHidden) newHidden.push(newSegIdx);
      newSegIdx += 1;
      continue;
    }
    const sxy = pointsById.get(refs[i].id);
    const exy = pointsById.get(refs[j].id);
    if (!sxy || !exy) {
      if (!aOk) newHidden.push(newSegIdx);
      else if (wasHidden) newHidden.push(newSegIdx);
      newSegIdx += 1;
      continue;
    }
    const newX = sxy.x + t * (exy.x - sxy.x);
    const newY = sxy.y + t * (exy.y - sxy.y);
    const factoryResult = newPointFactory(newX, newY);
    pointsToAdd.push(factoryResult);
    const otI = refs[i].offsetTop ?? 0;
    const otJ = refs[j].offsetTop ?? 0;
    const obI = refs[i].offsetBottom ?? 0;
    const obJ = refs[j].offsetBottom ?? 0;
    const otMid = otI + t * (otJ - otI);
    const obMid = obI + t * (obJ - obI);
    newRefs.push({
      id: factoryResult.id,
      offsetTop: otMid,
      offsetBottom: obMid,
      isSliding: true,
    });
    inserted += 1;
    // Segment splits into newSegIdx (a → mid) and newSegIdx + 1 (mid → b).
    if (aOk) {
      // a → mid is visible (inherit wasHidden), mid → b is negative-span hidden.
      if (wasHidden) newHidden.push(newSegIdx);
      newHidden.push(newSegIdx + 1);
    } else {
      // a → mid is negative-span hidden, mid → b is visible (inherit wasHidden).
      newHidden.push(newSegIdx);
      if (wasHidden) newHidden.push(newSegIdx + 1);
    }
    newSegIdx += 2;
  }

  // Detect whether anything actually changed vs the inputs so the caller can
  // skip a redundant DB write.
  const newHiddenSorted = Array.from(new Set(newHidden)).sort((a, b) => a - b);
  const oldHiddenSorted = Array.from(oldHidden).sort((a, b) => a - b);
  const hiddenChanged =
    newHiddenSorted.length !== oldHiddenSorted.length ||
    newHiddenSorted.some((v, i) => v !== oldHiddenSorted[i]);
  const changed = inserted > 0 || hiddenChanged;

  return {
    refs: newRefs,
    hiddenSegmentsIdx: newHiddenSorted,
    pointsToAdd,
    changed,
  };
}
