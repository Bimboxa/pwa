/**
 * Per-segment flag storage, keyed by point ID.
 *
 * POLYLINE / POLYGON / STRIP annotations carry per-segment flag arrays on the
 * annotation root (main ring) and on each `annotation.cuts[i]` (cut rings).
 * Segment i = points[i] → points[i+1]; on a closed ring the closing segment is
 * n-1 (points[n-1] → points[0]). A segment is therefore identified by its
 * START point.
 *
 * Historically the flags were persisted as segment INDEX arrays
 * (`hiddenSegmentsIdx` & siblings), which break whenever points are inserted,
 * deleted or dropped at resolve time (orphaned refs). The persisted source of
 * truth is now the START POINT ID arrays (`hiddenSegmentsPointIds` &
 * siblings) — ids survive every point-set edit.
 *
 * Compatibility contract:
 * - If the id field is present (Array.isArray), it WINS — even empty (empty
 *   means "migrated, nothing flagged"). Absent/undefined = not migrated →
 *   derive from the legacy idx field against the RAW db refs array (the array
 *   the indices were written against, orphans included).
 * - Readers keep consuming the idx fields: useAnnotationsV2 recomputes an
 *   EFFECTIVE idx array on the resolved ring at load time.
 * - Writers persist the id fields and clear the legacy idx fields in the same
 *   update (migrate-on-write). No write-back at load.
 */

export const SEGMENT_FLAG_FIELDS = [
  { idxField: "hiddenSegmentsIdx", idField: "hiddenSegmentsPointIds" },
  { idxField: "isoHeightSegmentsIdx", idField: "isoHeightSegmentsPointIds" },
  { idxField: "isExtEdgeSegmentsIdx", idField: "isExtEdgeSegmentsPointIds" },
  { idxField: "isIntEdgeSegmentsIdx", idField: "isIntEdgeSegmentsPointIds" },
];

export const SEGMENT_FLAG_ID_FIELD_BY_IDX_FIELD = Object.fromEntries(
  SEGMENT_FLAG_FIELDS.map(({ idxField, idField }) => [idxField, idField])
);

/** Closed-ring convention shared by qties / renderers (cut rings are always closed). */
export function getAnnotationRingClosed(annotation) {
  return annotation?.type === "POLYGON" || annotation?.closeLine === true;
}

const _pointId = (p) => p?.id ?? p?.pointId;

/**
 * Segment indices → start point ids, against the points array the indices
 * were written for (RAW db refs order). Invalid / out-of-range indices and
 * id-less points are dropped.
 */
export function segmentIdxToPointIds(idxArray, points, { closed = false } = {}) {
  if (!Array.isArray(idxArray) || !Array.isArray(points)) return [];
  const n = points.length;
  const segmentCount = closed ? n : n - 1;
  const out = [];
  const seen = new Set();
  for (const idx of idxArray) {
    if (!Number.isInteger(idx) || idx < 0 || idx >= segmentCount) continue;
    const id = _pointId(points[idx]);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Start point ids → segment indices on `ringPoints` (typically the RESOLVED
 * ring). Ids not found are dropped; on an open path the last point starts no
 * segment, so its id is dropped too. Result is sorted ascending.
 */
export function segmentPointIdsToIdx(idArray, ringPoints, { closed = false } = {}) {
  if (!Array.isArray(idArray) || !Array.isArray(ringPoints)) return [];
  const posById = new Map();
  ringPoints.forEach((p, i) => {
    const id = _pointId(p);
    if (id && !posById.has(id)) posById.set(id, i);
  });
  const segmentCount = closed ? ringPoints.length : ringPoints.length - 1;
  const out = new Set();
  for (const id of idArray) {
    const pos = posById.get(id);
    if (pos == null || pos >= segmentCount) continue;
    out.add(pos);
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Read one ring's flag as point ids, with the id-field-wins precedence.
 * `ringHolder` is the annotation root or a cut object; `refPoints` is that
 * ring's RAW refs array. Returns null when neither field is present.
 */
export function getRingSegmentFlagPointIds(
  ringHolder,
  idxField,
  idField,
  refPoints,
  { closed = false } = {}
) {
  if (!ringHolder) return null;
  if (Array.isArray(ringHolder[idField])) return ringHolder[idField];
  if (!Array.isArray(ringHolder[idxField])) return null;
  return segmentIdxToPointIds(ringHolder[idxField], refPoints, { closed });
}

/** True when the ring carries at least one flag field (legacy idx or id). */
export const hasAnySegmentFlagField = (ringHolder) =>
  SEGMENT_FLAG_FIELDS.some(
    ({ idxField, idField }) =>
      Array.isArray(ringHolder?.[idxField]) || Array.isArray(ringHolder?.[idField])
  );

const _ringHasLegacyField = (ringHolder) =>
  SEGMENT_FLAG_FIELDS.some(({ idxField }) => ringHolder?.[idxField] !== undefined);

/**
 * Full-row migration for writers: given the RAW db row, build the `changes`
 * object converting every flag (root + cuts) to id fields and clearing the
 * legacy idx fields (undefined → Dexie deletes the key). Returns null when the
 * row is already fully migrated (nothing to write).
 */
export function materializeSegmentFlagIds(rawAnnotation) {
  if (!rawAnnotation) return null;
  const changes = {};
  const closed = getAnnotationRingClosed(rawAnnotation);

  if (_ringHasLegacyField(rawAnnotation)) {
    for (const { idxField, idField } of SEGMENT_FLAG_FIELDS) {
      const ids = getRingSegmentFlagPointIds(
        rawAnnotation,
        idxField,
        idField,
        rawAnnotation.points,
        { closed }
      );
      if (ids != null && !Array.isArray(rawAnnotation[idField]))
        changes[idField] = ids;
      if (rawAnnotation[idxField] !== undefined) changes[idxField] = undefined;
    }
  }

  const cuts = rawAnnotation.cuts;
  if (Array.isArray(cuts) && cuts.some((cut) => _ringHasLegacyField(cut))) {
    changes.cuts = cuts.map((cut) => {
      if (!_ringHasLegacyField(cut)) return cut;
      const nextCut = { ...cut };
      for (const { idxField, idField } of SEGMENT_FLAG_FIELDS) {
        const ids = getRingSegmentFlagPointIds(cut, idxField, idField, cut.points, {
          closed: true,
        });
        if (ids != null && !Array.isArray(cut[idField])) nextCut[idField] = ids;
        delete nextCut[idxField];
      }
      return nextCut;
    });
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

/**
 * Map a RESOLVED cut index (the one encoded in `::CUT_SEG::` partIds) to the
 * RAW db row cut index. The resolve pipeline drops degenerate cuts (< 3
 * resolved points), so positions can diverge: match by cut id first, fall
 * back to position when no cut was dropped. Returns -1 when unmatchable.
 */
export function getRawCutIndex(resolvedCuts, rawCuts, resolvedCutIdx) {
  const resolvedCut = resolvedCuts?.[resolvedCutIdx];
  if (!resolvedCut) return -1;
  if (resolvedCut.id != null) {
    const byId = (rawCuts || []).findIndex((c) => c?.id === resolvedCut.id);
    if (byId >= 0) return byId;
  }
  return (rawCuts?.length ?? 0) === (resolvedCuts?.length ?? 0)
    ? resolvedCutIdx
    : -1;
}

/** Toggle each of `pointIds` in `list` (add if absent, remove if present). */
export function toggleSegmentPointIds(list, pointIds) {
  const set = new Set(list || []);
  for (const id of pointIds) {
    if (set.has(id)) set.delete(id);
    else set.add(id);
  }
  return [...set];
}

const _applyIdsOp = (list, ids, mode) => {
  const set = new Set(list || []);
  for (const id of ids) {
    if (mode === "set") set.add(id);
    else if (mode === "remove") set.delete(id);
    else if (set.has(id)) set.delete(id);
    else set.add(id);
  }
  return [...set];
};

const _filterOutIds = (list, ids) => {
  const drop = new Set(ids);
  return (list || []).filter((id) => !drop.has(id));
};

/**
 * Writer recipe shared by the interactive flag toggles: build the db `changes`
 * object applying per-ring operations on a flag, with the full-row legacy
 * migration folded in.
 *
 * - `record` is the RAW db row (never write resolved pixel points back).
 * - `resolvedAnnotation` is the useAnnotationsV2 output: the transient segment
 *   indices decoded from partIds are valid against ITS rings, so they are
 *   mapped to start point ids here.
 * - `ops`: [{ idxField, ringKey ('MAIN' | 'CUT::<resolvedCutIdx>'), segIdxs,
 *   mode ('toggle' | 'set' | 'remove'), clearIdxField? }]. `clearIdxField` is
 *   the mutually-exclusive opposite flag, cleared on the same segments when
 *   mode is 'set'.
 *
 * Returns the changes object, or null when there is nothing to write.
 */
export function buildSegmentFlagChanges({ record, resolvedAnnotation, ops }) {
  if (!record || !resolvedAnnotation) return null;
  const changes = materializeSegmentFlagIds(record) || {};

  // Current root value of an id field, pending migration included.
  const rootCurrent = (idField) => changes[idField] ?? record[idField] ?? [];

  const ensureCuts = () => {
    if (!changes.cuts) changes.cuts = [...(record.cuts || [])];
    return changes.cuts;
  };

  let touched = false;

  for (const op of ops || []) {
    const { idxField, ringKey, segIdxs, mode = "toggle", clearIdxField } = op;
    const idField = SEGMENT_FLAG_ID_FIELD_BY_IDX_FIELD[idxField];
    const clearIdField = clearIdxField
      ? SEGMENT_FLAG_ID_FIELD_BY_IDX_FIELD[clearIdxField]
      : null;
    if (!idField || !segIdxs?.length) continue;

    if (ringKey === "MAIN") {
      const pointIds = segIdxs
        .map((i) => _pointId(resolvedAnnotation.points?.[i]))
        .filter(Boolean);
      if (!pointIds.length) continue;
      changes[idField] = _applyIdsOp(rootCurrent(idField), pointIds, mode);
      if (record[idxField] !== undefined) changes[idxField] = undefined;
      if (clearIdField && mode === "set") {
        changes[clearIdField] = _filterOutIds(rootCurrent(clearIdField), pointIds);
        if (record[clearIdxField] !== undefined) changes[clearIdxField] = undefined;
      }
      touched = true;
    } else {
      const resolvedCutIdx = Number(String(ringKey).split("::")[1]);
      const resolvedCut = resolvedAnnotation.cuts?.[resolvedCutIdx];
      const rawCutIdx = getRawCutIndex(
        resolvedAnnotation.cuts,
        record.cuts,
        resolvedCutIdx
      );
      if (!resolvedCut || rawCutIdx < 0) continue;
      const pointIds = segIdxs
        .map((i) => _pointId(resolvedCut.points?.[i]))
        .filter(Boolean);
      if (!pointIds.length) continue;
      const cuts = ensureCuts();
      const cut = { ...cuts[rawCutIdx] };
      cut[idField] = _applyIdsOp(cut[idField], pointIds, mode);
      delete cut[idxField];
      if (clearIdField && mode === "set") {
        cut[clearIdField] = _filterOutIds(cut[clearIdField], pointIds);
        delete cut[clearIdxField];
      }
      cuts[rawCutIdx] = cut;
      touched = true;
    }
  }

  if (!touched && Object.keys(changes).length === 0) return null;
  return changes;
}

/**
 * Remap a flag id array after point refs were INSERTED into a ring, keeping
 * the historical both-halves semantics of remapSegmentIdxAfterInsert: an
 * insertion inside a flagged segment flags every resulting sub-segment (hiding
 * half a formerly hidden segment would make it reappear). For each flagged
 * start id, every new point lying strictly between the old start and old end
 * refs is flagged too.
 */
export function remapSegmentPointIdsAfterInsert(
  oldPoints,
  newPoints,
  idArray,
  { closed = false } = {}
) {
  if (!Array.isArray(idArray) || idArray.length === 0) return [];

  const oldPosById = new Map();
  oldPoints.forEach((p, i) => {
    const id = _pointId(p);
    if (id && !oldPosById.has(id)) oldPosById.set(id, i);
  });
  const newPosById = new Map();
  newPoints.forEach((p, i) => {
    const id = _pointId(p);
    if (id && !newPosById.has(id)) newPosById.set(id, i);
  });

  const n = oldPoints.length;
  const m = newPoints.length;
  const oldSegmentCount = closed ? n : n - 1;

  const out = new Set();
  for (const id of idArray) {
    const j = oldPosById.get(id);
    if (j == null || j >= oldSegmentCount) continue;
    const startNew = newPosById.get(id);
    const endNew = newPosById.get(_pointId(oldPoints[(j + 1) % n]));
    if (startNew == null || endNew == null) continue;

    let k = startNew;
    let guard = 0;
    while (k !== endNew && guard++ <= m) {
      const newId = _pointId(newPoints[k]);
      if (newId) out.add(newId);
      k = (k + 1) % m;
    }
  }
  return [...out];
}

/**
 * Writer recipe for point-REMOVAL paths (deletePointAsync / useDeletePoints):
 * full-row migration + drop the flag ids whose start point is gone.
 * `newPoints` / `newCuts` are the post-removal refs, `newCuts` aligned 1:1
 * with `record.cuts` (each entry a shallow copy of the raw cut with filtered
 * points). Returns { rootChanges, cuts }: root flag updates (id fields +
 * legacy idx cleared) and the cuts array augmented with per-cut flag ids.
 */
export function applySegmentFlagsAfterPointRemoval({ record, newPoints, newCuts }) {
  const closed = getAnnotationRingClosed(record);
  const rootChanges = {};
  for (const { idxField, idField } of SEGMENT_FLAG_FIELDS) {
    const ids = getRingSegmentFlagPointIds(record, idxField, idField, record.points, {
      closed,
    });
    if (ids != null) {
      const filtered = filterSegmentPointIds(ids, newPoints);
      if (!Array.isArray(record[idField]) || filtered !== record[idField])
        rootChanges[idField] = filtered;
    }
    if (record[idxField] !== undefined) rootChanges[idxField] = undefined;
  }
  const cuts = (newCuts || []).map((cut, i) => {
    const rawCut = record.cuts?.[i];
    if (!rawCut || !hasAnySegmentFlagField(rawCut)) return cut;
    const nextCut = { ...cut };
    for (const { idxField, idField } of SEGMENT_FLAG_FIELDS) {
      const ids = getRingSegmentFlagPointIds(rawCut, idxField, idField, rawCut.points, {
        closed: true,
      });
      if (ids != null) nextCut[idField] = filterSegmentPointIds(ids, cut.points);
      delete nextCut[idxField];
    }
    return nextCut;
  });
  return { rootChanges, cuts };
}

/**
 * After point removal / dedup: keep only ids whose point is still in the ring
 * (a segment whose start point disappeared loses its flag — the merged segment
 * becomes unflagged). Identity on no change.
 */
export function filterSegmentPointIds(idArray, newPoints) {
  if (!Array.isArray(idArray) || idArray.length === 0) return idArray;
  const kept = new Set();
  for (const p of newPoints || []) {
    const id = _pointId(p);
    if (id) kept.add(id);
  }
  const out = idArray.filter((id) => kept.has(id));
  return out.length === idArray.length ? idArray : out;
}
