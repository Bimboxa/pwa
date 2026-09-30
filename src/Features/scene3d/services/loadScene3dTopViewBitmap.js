import db from "App/db/db";

// Top view image of a SCENE_3D annotation as an ImageBitmap (canvas
// exports), or null when the annotation has none. The caller closes it.
export default async function loadScene3dTopViewBitmap(annotation) {
  const fileName = annotation?.scene3d?.topView?.fileName;
  if (!fileName) return null;
  const record = await db.files.get(fileName);
  if (!record?.fileArrayBuffer) return null;
  return createImageBitmap(
    new Blob([record.fileArrayBuffer], { type: record.fileMime })
  );
}
