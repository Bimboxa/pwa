import db from "App/db/db";
import testIsImage from "Features/files/utils/testIsImage";
import getImageSizeAsync from "Features/images/utils/getImageSizeAsync";

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
        const blob = new Blob([file.fileArrayBuffer], { type: file.fileMime })
        const url = URL.createObjectURL(blob)

        entityWithImages[key] = {
          ...value,
          file,
          imageUrlClient: url,
        };

        if (testIsImage(blob)) {
          const imageSize = await getImageSizeAsync(url);
          entityWithImages[key].imageSize = imageSize;
        }
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
