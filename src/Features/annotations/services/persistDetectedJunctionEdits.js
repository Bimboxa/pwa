// Called inside the creation transaction. Fork moved endpoints so annotations
// outside the junction keep their shared point coordinates unchanged.
export default async function persistDetectedJunctionEdits({
  db,
  edits,
  baseMapId,
  imageSize,
  createId,
}) {
  const grouped = new Map();
  for (const edit of edits) {
    if (!grouped.has(edit.annotationId))
      grouped.set(edit.annotationId, new Map());
    grouped.get(edit.annotationId).set(edit.pointId, edit);
  }
  for (const [annotationId, pointEdits] of grouped) {
    const annotation = await db.annotations.get(annotationId);
    if (
      !annotation ||
      annotation.deletedAt ||
      annotation.baseMapId !== baseMapId
    )
      throw new Error("Junction neighbor is no longer available");
    const points = [...annotation.points];
    for (const [pointId, edit] of pointEdits) {
      const index = points.findIndex((p) => p.id === pointId);
      const before = await db.points.get(pointId);
      if (
        index < 0 ||
        !before ||
        !edit.before ||
        Math.abs(before.x * imageSize.width - edit.before.x) > 0.01 ||
        Math.abs(before.y * imageSize.height - edit.before.y) > 0.01
      )
        throw new Error("Junction neighbor changed during detection");
      const id = createId();
      await db.points.add({
        id,
        baseMapId,
        projectId: annotation.projectId,
        x: edit.x / imageSize.width,
        y: edit.y / imageSize.height,
      });
      const reference = { ...points[index], id };
      delete reference.x;
      delete reference.y;
      points[index] = reference;
    }
    await db.annotations.update(annotationId, { points });
  }
}
