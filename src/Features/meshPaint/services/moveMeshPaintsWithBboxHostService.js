import db from "App/db/db";

import { isMeshPaintStaleForHost } from "Features/meshPaint/services/copyMeshPaintsService";
import applyAffineToPaintGeometry from "Features/meshPaint/utils/applyAffineToPaintGeometry";

const isLive = (row) => Boolean(row) && !row.deletedAt;

/**
 * Painted parts (db.meshPaints) of a BBOX-based host (OBJECT_3D) follow its
 * 2D move / rotation — the counterpart of commitWrapperTransform's step 4g
 * for hosts without db.points: the host's pixel affine
 * (buildBboxHostAffine) is applied to every live paint of the host, and
 * `sync.syncedAt` is refreshed on the paints that were not « à vérifier »
 * before (a moved paint must not come out stale against the host's new
 * audit stamp).
 *
 * Meant to run INSIDE the caller's transaction / undo group (the host
 * update and its paints are one undo step): Dexie joins the ambient
 * transaction, which must include db.meshPaints.
 *
 * @param {object} params
 * @param {string} params.hostId
 * @param {object} params.host - the host's db row BEFORE the update (stale
 *   rule); null skips the syncedAt refresh
 * @param {{a, b, c, d, e, f}} params.affine - pixel affine of the transform
 * @param {{width: number, height: number}} params.imageSize - base map image
 * @param {{imageWidth: number, imageHeight: number, meterByPx: number}|null} params.metrics
 *   frame metrics of the host's base map (slanted-face normals)
 * @returns {Promise<string[]>} ids of the moved paints
 */
export default async function moveMeshPaintsWithBboxHostService({
  hostId,
  host = null,
  affine,
  imageSize,
  metrics = null,
}) {
  if (!hostId || !affine || !(imageSize?.width > 0 && imageSize?.height > 0)) {
    return [];
  }
  const rows = (
    await db.meshPaints.where("hostAnnotationId").equals(hostId).toArray()
  ).filter(isLive);
  if (!rows.length) return [];

  const syncedAt = new Date().toISOString();
  const moved = [];
  for (const row of rows) {
    const geometry = applyAffineToPaintGeometry({
      partType: row.partType,
      geometry: row.geometry,
      affine,
      imageSize,
      dz: 0,
      metrics: metrics ?? undefined,
    });
    if (!geometry || geometry === row.geometry) continue;
    const refreshSyncedAt = host ? !isMeshPaintStaleForHost(row, host) : false;
    await db.meshPaints.update(row.id, {
      geometry,
      ...(refreshSyncedAt ? { sync: { ...(row.sync ?? {}), syncedAt } } : {}),
    });
    moved.push(row.id);
  }
  return moved;
}
