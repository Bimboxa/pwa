import { fingerprint } from "./annotationBatchService.js";

async function readSource(db, baseMapId) {
  const [record, versions] = await Promise.all([
    db.baseMaps.get(baseMapId),
    db.baseMapVersions.where("baseMapId").equals(baseMapId).toArray(),
  ]);
  if (!record || record.deletedAt) {
    throw Object.assign(new Error("BATCH_TARGET_NOT_FOUND: baseMap"), {
      code: "BATCH_TARGET_NOT_FOUND",
    });
  }
  return { record, versions: versions.filter((v) => !v.deletedAt) };
}

// Publication uses a hydrated BaseMap: ImageObject computes actual dimensions
// and PDF details may be rendered lazily. Reconstructing it with raw image
// metadata can produce a different refSize/imageKey for an unchanged plan.
// Hydrate outside the mutation transaction, then check the original records
// again inside it, so async image loading cannot auto-close IndexedDB or hide
// a real frame change during preparation.
export async function prepareAnnotationBatchFrame(
  db,
  baseMapId,
  hydrate,
  summarize
) {
  const source = await db.transaction(
    "r",
    [db.baseMaps, db.baseMapVersions],
    () => readSource(db, baseMapId)
  );
  const sourceFingerprint = fingerprint(source);
  const baseMap = await hydrate(source.record, source.versions);
  const context = summarize(baseMap);
  const frame = {
    imageKey: context.imageKey,
    meterByPx: context.meterByPx,
    refSize: { width: context.refWidth, height: context.refHeight },
  };
  return async () => {
    if (fingerprint(await readSource(db, baseMapId)) !== sourceFingerprint) {
      throw Object.assign(new Error("BATCH_FRAME_CHANGED: persistedSource"), {
        code: "BATCH_FRAME_CHANGED",
      });
    }
    return frame;
  };
}
