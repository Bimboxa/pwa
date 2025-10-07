import db from "App/db/db";

export default async function getEntityWithImagesAsync(entity) {
  const entityWithImages = { ...entity };
  const entriesWithImages = Object.entries(entity).filter(
    ([key, value]) => value?.isImage
  );
  await Promise.all(
    entriesWithImages.map(async ([key, value]) => {
      if (value.fileName) {
        const file = await db.files.get(value.fileName);

        if (file && file.file) {
          entityWithImages[key] = {
            ...value,
            file,
            imageUrlClient: URL.createObjectURL(file.file),
          };
        }
      }
    })
  );
  return entityWithImages;
}
