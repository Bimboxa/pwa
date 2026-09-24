import db from "App/db/db";
import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import BaseMap from "Features/baseMaps/js/BaseMap";
import computeVerticalBaseMapPlacementFromLink from "Features/baseMaps/js/computeVerticalBaseMapPlacementFromLink";

// Single writer of the 3D pose (+ scale) of every VERTICAL base map that
// hosts the CLONE of a BASE_MAP_LINK section mark.
//
// The plan segment (source link) and its clone on the elevation are the
// source of truth: drawing the clone, or moving either segment afterwards,
// re-poses that elevation so the clone lands on the plan segment, with the
// observer on the arrows' side. Everything downstream — the 3D groups
// (useApplyBaseMapTransformsIn3d), the 2D scale consumers (cotes, CM
// strokes) — reacts to the two triggers dispatched at the end.
//
// This service ONLY ever writes VERTICAL base maps, and only when the pose
// actually moved (EPS guard). Same anti-loop discipline as
// resyncRevolutionAxisPlacementsService: readers never write back, a second
// run finds no delta and writes nothing.
//
// Several links may target the same elevation: each one may carry a clone,
// and the last clone committed / moved wins the pose.
const EPS = 1e-6;

const sameNumber = (a, b) => Math.abs((a ?? 0) - (b ?? 0)) < EPS;

const samePlacement = (record, next) =>
  sameNumber(record?.angleDeg, next.angleDeg) &&
  sameNumber(record?.position?.x, next.position.x) &&
  sameNumber(record?.position?.y, next.position.y) &&
  sameNumber(record?.position?.z, next.position.z) &&
  sameNumber(record?.meterByPx, next.meterByPx);

// Dexie records are plain objects; the solver needs the BaseMap getters
// (getImageSize / getMeterByPx resolve the versioned reference frame).
const hydrate = async (record) => {
  if (!record) return null;
  const versions = await db.baseMapVersions
    .where("baseMapId")
    .equals(record.id)
    .toArray();
  return BaseMap.createFromRecord(
    record,
    (versions ?? []).filter((v) => !v.deletedAt)
  );
};

const isClone = (a) =>
  a && !a.deletedAt && a.type === "BASE_MAP_LINK" && a.sourceLinkAnnotationId;

/**
 * Re-pose the vertical base maps driven by BASE_MAP_LINK clones.
 *
 * @param {Object} params
 * @param {string} [params.cloneId]       re-pose just this clone's elevation
 * @param {string} [params.sourceLinkId]  re-pose every clone of this link
 * @param {string} [params.planBaseMapId] re-pose every clone of every link
 *                                        hosted by this plan base map
 * @param {Function} [params.dispatch]    redux dispatch (to notify 2D / 3D)
 * @returns {Promise<number>} how many base maps actually changed
 */
export default async function resyncBaseMapLinkPlacementsService({
  cloneId,
  sourceLinkId,
  planBaseMapId,
  dispatch,
} = {}) {
  // --- resolve the clones to re-pose ---

  let clones = [];
  if (cloneId) {
    const one = await db.annotations.get(cloneId);
    if (isClone(one)) clones = [one];
  } else {
    const sourceIds = [];
    if (sourceLinkId) {
      sourceIds.push(sourceLinkId);
    } else if (planBaseMapId) {
      const links = await db.annotations
        .where("baseMapId")
        .equals(planBaseMapId)
        .filter(
          (a) =>
            !a.deletedAt &&
            a.type === "BASE_MAP_LINK" &&
            !a.sourceLinkAnnotationId
        )
        .toArray();
      sourceIds.push(...links.map((a) => a.id));
    }
    if (sourceIds.length === 0) return 0;

    clones = await db.annotations
      .filter((a) => isClone(a) && sourceIds.includes(a.sourceLinkAnnotationId))
      .toArray();
  }

  if (clones.length === 0) return 0;

  // --- solve + write ---

  const sourceCache = new Map();
  const baseMapCache = new Map();
  const getBaseMap = async (id) => {
    if (!id) return null;
    if (!baseMapCache.has(id))
      baseMapCache.set(id, await hydrate(await db.baseMaps.get(id)));
    return baseMapCache.get(id);
  };

  let changed = 0;

  for (const clone of clones) {
    const sId = clone.sourceLinkAnnotationId;
    if (!sId || !clone.baseMapId) continue;
    if (clone.points?.length !== 2) continue;

    if (!sourceCache.has(sId))
      sourceCache.set(sId, await db.annotations.get(sId));
    const source = sourceCache.get(sId);
    if (!source || source.deletedAt || source.points?.length !== 2) continue;
    // A clone left on a base map the link no longer targets is inert.
    if (source.linkedBaseMapId !== clone.baseMapId) continue;

    const [p1, p2, q1, q2] = await db.points.bulkGet([
      source.points[0].id,
      source.points[1].id,
      clone.points[0].id,
      clone.points[1].id,
    ]);
    if (!p1 || !p2 || !q1 || !q2) continue;

    const planBaseMap = await getBaseMap(source.baseMapId);
    const elevationBaseMap = await getBaseMap(clone.baseMapId);
    if (!planBaseMap || !elevationBaseMap) continue;

    const next = computeVerticalBaseMapPlacementFromLink({
      planBaseMap,
      elevationBaseMap,
      planNorm: { p1: { x: p1.x, y: p1.y }, p2: { x: p2.x, y: p2.y } },
      cloneNorm: { q1: { x: q1.x, y: q1.y }, q2: { x: q2.x, y: q2.y } },
    });
    if (!next) continue;

    const record = await db.baseMaps.get(clone.baseMapId);
    if (samePlacement(record, next)) continue;

    await db.baseMaps.update(clone.baseMapId, {
      angleDeg: next.angleDeg,
      position: next.position,
      meterByPx: next.meterByPx,
      // Provenance, same contract as the revolution-axis pose writer.
      poseSource: "BASE_MAP_LINK",
      poseSourceAnnotationId: clone.id,
    });
    changed += 1;
  }

  if (changed > 0 && dispatch) {
    dispatch(triggerBaseMapsUpdate());
    // meterByPx is read by the 2D scale consumers through
    // entitiesTableUpdatedAt.baseMaps (useBaseMaps / useAnnotationsV2).
    dispatch(triggerEntitiesTableUpdate("baseMaps"));
  }
  return changed;
}

/**
 * Cheap post-commit hook for the point-move paths: re-pose whatever the
 * moved annotations drive. No-op for annotations that are not BASE_MAP_LINK.
 */
export async function resyncBaseMapLinksForAnnotationIds({
  annotationIds,
  dispatch,
} = {}) {
  const ids = [...new Set((annotationIds ?? []).filter(Boolean))];
  if (ids.length === 0) return 0;
  const rows = (await db.annotations.bulkGet(ids)).filter(
    (a) => a && !a.deletedAt && a.type === "BASE_MAP_LINK"
  );
  let changed = 0;
  for (const a of rows) {
    changed += a.sourceLinkAnnotationId
      ? await resyncBaseMapLinkPlacementsService({ cloneId: a.id, dispatch })
      : await resyncBaseMapLinkPlacementsService({
          sourceLinkId: a.id,
          dispatch,
        });
  }
  return changed;
}
