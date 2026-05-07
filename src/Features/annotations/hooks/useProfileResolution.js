import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";
import { expandArcsInPath } from "Features/geometry/utils/arcSampling";

// Match the codebase convention (used in createAnnotationObject3D,
// detectPolygonFromAnnotations, useWallBoundaries) so curved profiles look
// consistent with how curved annotations are sampled elsewhere.
const ARC_SAMPLES = 6;

// Resolve all annotations that compose a profile (those carrying the given
// `profileTemplateId`), with their points denormalized to pixel space and
// their basemaps attached. Also pick the "primary" profile annotation (the
// one that defines the anchor) and pre-compute the total profile length in
// meters.
//
// Primary selection rule:
//   1. smallest `createdAt` (oldest) — assumed to be the reference profile
//   2. fallback (when createdAt is missing or equal): highest opacity
//      (`strokeOpacity`, then `fillOpacity`)
//
// The returned shape is intentionally simple so both the React-side
// quantities pipeline and the Three.js renderer (via a parallel Promise-based
// resolver) can share the same model.
export default function useProfileResolution(profileTemplateId) {
  return useLiveQuery(async () => {
    if (!profileTemplateId) return null;
    return resolveProfileFromDb(profileTemplateId);
  }, [profileTemplateId]);
}

// Promise-based variant for callers outside of React (e.g. the 3D renderer
// which is a plain function, not a hook). Keep both code paths in lockstep.
export async function resolveProfileFromDb(profileTemplateId) {
  if (!profileTemplateId) return null;

  const annotsAll = await db.annotations
    .where("annotationTemplateId")
    .equals(profileTemplateId)
    .toArray();
  const annots = annotsAll.filter((a) => !a.deletedAt);
  if (annots.length === 0) return null;

  const pointIds = [
    ...new Set(annots.flatMap((a) => (a.points || []).map((p) => p.id))),
  ];
  const pointsRaw = pointIds.length > 0 ? await db.points.bulkGet(pointIds) : [];
  const pointById = new Map(
    pointsRaw.filter(Boolean).map((p) => [p.id, p])
  );

  const baseMapIds = [...new Set(annots.map((a) => a.baseMapId).filter(Boolean))];
  const baseMapsRaw = baseMapIds.length > 0
    ? await db.baseMaps.bulkGet(baseMapIds)
    : [];
  const baseMapById = new Map(
    baseMapsRaw.filter(Boolean).map((b) => [b.id, b])
  );

  const profiles = annots
    .map((annotation) => {
      const baseMap = baseMapById.get(annotation.baseMapId);
      const imageSize = baseMap?.image?.imageSize;
      // Preserve `ref.type` (square / circle) — `circle` markers form the
      // middle of S-C-S arc triplets and are used by `expandArcsInPath`.
      const rawPx = (annotation.points || [])
        .map((ref) => {
          const p = pointById.get(ref.id);
          if (!p || !imageSize) return null;
          return {
            x: p.x * imageSize.width,
            y: p.y * imageSize.height,
            type: ref.type,
          };
        })
        .filter(Boolean);
      // Expand each S-C-S triplet into a polyline approximating the arc.
      // After expansion the profile is a plain set of straight segments —
      // the 3D sweep and the length integration both work directly on it.
      const pointsPx = rawPx.length >= 3
        ? expandArcsInPath(rawPx, ARC_SAMPLES)
        : rawPx;
      return { annotation, baseMap, pointsPx };
    })
    .filter((p) => p.pointsPx.length >= 2);

  if (profiles.length === 0) return null;

  const primary = pickPrimary(profiles);
  const anchorPx = primary?.pointsPx?.[0] ?? null;

  const profileLengthMeters = profiles.reduce((sum, p) => {
    const mbp = p.baseMap?.meterByPx;
    if (!mbp) return sum;
    let lenPx = 0;
    for (let i = 0; i < p.pointsPx.length - 1; i++) {
      lenPx += Math.hypot(
        p.pointsPx[i + 1].x - p.pointsPx[i].x,
        p.pointsPx[i + 1].y - p.pointsPx[i].y
      );
    }
    return sum + lenPx * mbp;
  }, 0);

  return { primary, profiles, anchorPx, profileLengthMeters };
}

function pickPrimary(profiles) {
  if (profiles.length === 0) return null;

  // 1) oldest by createdAt
  const withTs = profiles.filter((p) => p.annotation.createdAt);
  if (withTs.length > 0) {
    const sorted = [...withTs].sort((a, b) =>
      a.annotation.createdAt < b.annotation.createdAt ? -1 : 1
    );
    return sorted[0];
  }

  // 2) fallback: highest strokeOpacity, then fillOpacity
  const sorted = [...profiles].sort((a, b) => {
    const oa = a.annotation.strokeOpacity ?? a.annotation.fillOpacity ?? 0;
    const ob = b.annotation.strokeOpacity ?? b.annotation.fillOpacity ?? 0;
    return ob - oa;
  });
  return sorted[0];
}
