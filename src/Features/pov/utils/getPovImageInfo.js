import db from "App/db/db";

// Preferred display image of a POV (AI-transformed wins over the raw capture),
// decoded to expose its natural pixel size.
export default async function getPovImageInfo(pov) {
  const fileName = pov?.transformedImage?.fileName ?? pov?.image?.fileName;
  if (!fileName) return null;

  const fileRecord = await db.files.get(fileName);
  if (!fileRecord?.fileArrayBuffer) return null;

  const blob = new Blob([fileRecord.fileArrayBuffer], {
    type: fileRecord.fileMime || "image/png",
  });

  try {
    const bitmap = await createImageBitmap(blob);
    const info = { fileName, width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return info;
  } catch {
    return null;
  }
}
