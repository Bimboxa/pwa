import db from "App/db/db";

export default async function getEntityWithImagesAsync(entity) {
  if (!entity) return {};

  let hasImages;
  const entityWithImages = { ...entity };
  const entriesWithImages = Object.entries(entity).filter(
    ([key, value]) => value?.isImage
  );

  for (let [key, value] of entriesWithImages) {
    if (value.fileName) {
      const file = await db.files.get(value.fileName);
      if (file && file.fileArrayBuffer) {
        const url = URL.createObjectURL(
          new Blob([file.fileArrayBuffer], { type: file.fileMime })
        );

        entityWithImages[key] = {
          ...value,
          file,
          imageUrlClient: url,
        };
      } else {
        entityWithImages[key] = {
          ...value,
          imageUrlClient: null,
        };
      }
      hasImages = true;
    }
  }

  // await Promise.all(
  //   entriesWithImages.map(async ([key, value]) => {
  //     if (value.fileName) {
  //       const file = await db.files.get(value.fileName);

  //       if (file && file.fileArrayBuffer) {
  //         entityWithImages[key] = {
  //           ...value,
  //           file,
  //           imageUrlClient: URL.createObjectURL(
  //             new Blob([file.fileArrayBuffer], { type: file.fileMime })
  //           ),
  //         };
  //         hasImages = true;
  //       }
  //     }
  //   })
  // );
  return { entityWithImages, hasImages };
}
