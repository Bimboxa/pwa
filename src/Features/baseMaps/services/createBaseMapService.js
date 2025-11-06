import BaseMap from "../js/BaseMap";

import db from "App/db/db";

export default async function createBaseMapService({
  projectId,
  name,
  image,
  imageFile,
  imageEnhanced,
  imageEnhancedFile,
}) {
  const baseMap = await BaseMap.create({
    projectId,
    image,
    imageFile,
    imageEnhanced,
    imageEnhancedFile,
    name,
  });
  const { baseMapRecord, projectFileRecords } = await baseMap.toDb();

  await db.transaction("rw", db.baseMaps, db.projectFiles, async () => {
    await db.baseMaps.add(baseMapRecord);
    for (const projectFileRecord of projectFileRecords) {
      await db.projectFiles.add(projectFileRecord);
    }
  });

  return baseMap;
}
