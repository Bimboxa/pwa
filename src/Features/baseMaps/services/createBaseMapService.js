import BaseMap from "../js/BaseMap";

import db from "App/db/db";

export default async function createBaseMapService({
  projectId,
  name,
  imageFile,
}) {
  const baseMap = await BaseMap.create({ projectId, imageFile, name });
  const { baseMapRecord, projectFileRecord } = baseMap.toDb();

  await db.transaction("rw", db.baseMaps, db.projectFiles, async () => {
    await db.baseMaps.add(baseMapRecord);
    await db.projectFiles.add(projectFileRecord);
  });
}
