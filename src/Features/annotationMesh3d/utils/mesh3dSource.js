// "Source" snapshot of an annotation converted to a mesh: its ORIGINAL 2D
// geometry and parametric fields, kept on the row (annotation.mesh3dSource)
// so the conversion can be reverted ("Réinitialiser").
//
//   {
//     fields:    { type, height, offsetZ, … }   values overwritten by the mesh
//     unsetKeys: [ … ]                          keys the conversion ADDED
//     points:    [{ id, x, y, type?, offsetTop?, … }]
//     cuts:      [{ id, …, points: [...] }] | null
//     innerPoints: [...] | null
//   }
//
// Point refs are stored INLINE (normalized x, y next to the original ref
// props), not as db.points ids alone: the snapshot then survives everything
// an annotation goes through — copy / paste, scope duplication, import with
// id remapping, orphan point purge — and it can follow the transforms applied
// to the mesh. The original id is kept to re-weld with the neighbors and to
// remap the segment flags on restore.
//
// Pure: no db, no three.js.

// Never snapshotted as plain fields: the mesh itself, and the geometry arrays
// handled explicitly.
const GEOMETRY_KEYS = new Set([
  "mesh3d",
  "mesh3dSource",
  "isMesh3d",
  "points",
  "cuts",
  "innerPoints",
]);

// Row fields (root and per cut) holding db.points ids of segment starts.
const POINT_ID_FLAG_KEYS = [
  "hiddenSegmentsPointIds",
  "isoHeightSegmentsPointIds",
  "isExtEdgeSegmentsPointIds",
  "isIntEdgeSegmentsPointIds",
];

const inlineRefs = (refs, pointsById) =>
  (refs || []).map((ref) => {
    const row = pointsById?.get?.(ref?.id);
    return row ? { ...ref, x: row.x, y: row.y } : { ...ref };
  });

// Snapshot taken right before the first mesh write.
//
// annotation: the db row as it is. patch: the fields the conversion is about
// to write. pointsById: Map<pointId, {x, y}> (normalized) of its points.
export function buildMesh3dSource({ annotation, patch, pointsById }) {
  const fields = {};
  const unsetKeys = [];
  for (const key of Object.keys(patch)) {
    if (GEOMETRY_KEYS.has(key)) continue;
    if (annotation[key] === undefined) unsetKeys.push(key);
    else fields[key] = annotation[key];
  }
  return {
    fields,
    unsetKeys,
    points: inlineRefs(annotation.points, pointsById),
    cuts: Array.isArray(annotation.cuts)
      ? annotation.cuts.map((cut) => ({
          ...cut,
          points: inlineRefs(cut?.points, pointsById),
        }))
      : null,
    innerPoints: Array.isArray(annotation.innerPoints)
      ? inlineRefs(annotation.innerPoints, pointsById)
      : null,
  };
}

// Applies fn({x, y}) -> {x, y} to every inline point of a snapshot.
export function mapMesh3dSourcePoints(source, fn) {
  if (!source) return source;
  const mapRefs = (refs) =>
    (refs || []).map((ref) =>
      Number.isFinite(ref?.x) && Number.isFinite(ref?.y)
        ? { ...ref, ...fn({ x: ref.x, y: ref.y }) }
        : ref
    );
  return {
    ...source,
    points: mapRefs(source.points),
    cuts: source.cuts
      ? source.cuts.map((cut) => ({ ...cut, points: mapRefs(cut.points) }))
      : null,
    innerPoints: source.innerPoints ? mapRefs(source.innerPoints) : null,
  };
}

// Same affine map as applyAffineToMesh3d (pixel space), on the snapshot: the
// original geometry follows the moves / rotations of the mesh.
export function applyAffineToMesh3dSource(
  source,
  affine,
  imageSize,
  targetImageSize = imageSize
) {
  if (!source || !affine || !imageSize?.width || !imageSize?.height) {
    return source;
  }
  const { a, b, c, d, e, f } = affine;
  return mapMesh3dSourcePoints(source, ({ x, y }) => {
    const px = x * imageSize.width;
    const py = y * imageSize.height;
    return {
      x: (a * px + b * py + c) / targetImageSize.width,
      y: (d * px + e * py + f) / targetImageSize.height,
    };
  });
}

// Every inline point of a snapshot, in a stable order (points, cuts, inner).
export function getMesh3dSourcePoints(source) {
  return [
    ...(source?.points || []),
    ...(source?.cuts || []).flatMap((cut) => cut.points || []),
    ...(source?.innerPoints || []),
  ];
}

// The annotation patch that reverts a mesh to its snapshot.
//
// idByOldId: Map<original point id, point id to use now> — the caller
// resolved each inline point to a db.points row (the original one when it is
// still there, a welded neighbor, or a fresh row).
// Keys mapped to `undefined` are to be DELETED from the row (Dexie update).
export function buildMesh3dResetPatch(source, idByOldId) {
  const mapId = (id) => idByOldId?.get?.(id) ?? id;
  const toRefs = (refs) =>
    (refs || []).map((ref) => {
      // x / y live in db.points, never on the ref.
      const next = { ...ref, id: mapId(ref.id) };
      delete next.x;
      delete next.y;
      return next;
    });
  const remapFlags = (holder) => {
    const next = { ...holder };
    for (const key of POINT_ID_FLAG_KEYS) {
      if (Array.isArray(next[key])) next[key] = next[key].map(mapId);
    }
    return next;
  };

  const patch = remapFlags(source.fields || {});
  for (const key of source.unsetKeys || []) patch[key] = undefined;

  patch.points = toRefs(source.points);
  patch.cuts = source.cuts
    ? source.cuts.map((cut) => ({
        ...remapFlags(cut),
        points: toRefs(cut.points),
      }))
    : undefined;
  if (source.innerPoints) patch.innerPoints = toRefs(source.innerPoints);

  patch.isMesh3d = undefined;
  patch.mesh3d = undefined;
  patch.mesh3dSource = undefined;
  return patch;
}
