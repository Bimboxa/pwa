// Identity stabilization for the useAnnotationsV2 output.
//
// The hook pipeline rebuilds every annotation object on each run (template
// override, qties, subtractions, sort), so even an untouched annotation gets
// a brand-new reference — which defeats memo(NodeAnnotationStatic) and makes
// every SVG node re-render after any DB commit. This module compares the new
// run's output against the previous run's (per hook instance) and returns the
// PREVIOUS object whenever the content is structurally identical.
//
// Why structural equality instead of an `id + updatedAt` key: point moves are
// written to db.points without touching the annotation row, and the resolved
// annotation also depends on its template / base map / listings / subtractions
// / solo state. Comparing the pipeline OUTPUT is correct by construction.

// Beyond this depth two non-identical objects are treated as different —
// a cache miss (new reference), never a stale hit, so correctness is
// preserved; only reuse efficiency is lost.
const MAX_DEPTH = 5;

function boundedDeepEqual(a, b, depth) {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") {
    return Number.isNaN(a) && Number.isNaN(b);
  }
  // functions (e.g. getters attached by upstream hooks) are ignored
  if (typeof a === "function" && typeof b === "function") return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (depth <= 0) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!boundedDeepEqual(a[i], b[i], depth - 1)) return false;
    }
    return true;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!boundedDeepEqual(a[key], b[key], depth - 1)) return false;
  }
  return true;
}

// subtractionTargets embed other (full) annotations — compared by id only
// here; cross-annotation freshness is handled by the changed-ids propagation
// pass in stabilizeAnnotationsIdentity below.
function sameIdList(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]?.id !== b[i]?.id) return false;
  }
  return true;
}

// baseMap / entity are linked records (with methods, images…): compared by
// reference first, then by id + updatedAt scalars.
function sameLinkedRecord(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  return a.id != null && a.id === b.id && a.updatedAt === b.updatedAt;
}

export function annotationsStructurallyEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    const va = a[key];
    const vb = b[key];
    if (va === vb) continue;
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (key === "subtractionTargets") {
      if (!sameIdList(va, vb)) return false;
      continue;
    }
    if (key === "baseMap" || key === "entity") {
      if (!sameLinkedRecord(va, vb)) return false;
      continue;
    }
    if (typeof va === "function" && typeof vb === "function") continue;
    if (!boundedDeepEqual(va, vb, MAX_DEPTH)) return false;
  }
  return true;
}

/**
 * Maps the pipeline output to referentially-stable objects.
 *
 * @param {Object} state  Per-hook-instance cache: { byId: Map, prevArray }.
 *                        MUST NOT be shared across hook instances (options
 *                        like withEntity/withQties change the object shape).
 * @param {Array}  next   This run's pipeline output.
 * @returns {{ list: Array, reused: number }} `list` reuses the previous run's
 *          objects (and the previous array itself when nothing changed).
 */
export default function stabilizeAnnotationsIdentity(state, next) {
  const byId = state.byId;
  const nextIds = new Set();

  // Pass 1 — per-annotation decision on its own fields (subtraction targets
  // compared by id only).
  const decisions = next.map((item) => {
    const id = item?.id;
    if (id == null) return { id: null, item, prev: null, reusePrev: false };
    nextIds.add(id);
    const prev = byId.get(id);
    const reusePrev = prev != null && annotationsStructurallyEqual(prev, item);
    return { id, item, prev, reusePrev };
  });

  const changedIds = new Set();
  for (const d of decisions) {
    if (d.id != null && !d.reusePrev) changedIds.add(d.id);
  }

  // Pass 2 — a subtraction source must be refreshed when one of its targets
  // changed, so consumers (3D carve, qties) never read stale target geometry
  // through a reused source reference.
  let reused = 0;
  const list = decisions.map((d) => {
    const { id, item, prev } = d;
    let reusePrev = d.reusePrev;
    if (
      reusePrev &&
      item.subtractionTargetIds?.some((tid) => changedIds.has(tid))
    ) {
      reusePrev = false;
    }
    if (reusePrev) {
      reused += 1;
      return prev;
    }
    if (id != null) byId.set(id, item);
    return item;
  });

  // Purge ids absent from the current result.
  for (const id of byId.keys()) {
    if (!nextIds.has(id)) byId.delete(id);
  }

  // Stabilize the array identity itself when every element was reused.
  const prevArray = state.prevArray;
  if (
    prevArray &&
    prevArray.length === list.length &&
    list.every((item, i) => item === prevArray[i])
  ) {
    return { list: prevArray, reused };
  }
  state.prevArray = list;
  return { list, reused };
}
