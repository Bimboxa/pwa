// Entity image fields come in two shapes:
// - a fresh pick from FieldImageV2 (`{ file: File, imageUrlClient, imageSize,
//   thumbnail, … }`), which the entity pipeline turns into a db.files row;
// - a hydrated record (`getEntityWithImagesAsync`), whose `file` is the whole
//   db.files row (ArrayBuffer included) and whose `imageUrlClient` is a
//   session-only blob: URL.
// Copying a hydrated field verbatim into a draft / another entity would store
// the ArrayBuffer inline in that row. This keeps only the persistent
// reference, plus the File (and its preview URL) when there is one to store.
export default function getImageRefFromEntityImage(image) {
  if (!image || typeof image !== "object") return null;

  const isFile =
    typeof File !== "undefined" ? image.file instanceof File : false;

  const ref = { isImage: true };
  if (image.fileName != null) ref.fileName = image.fileName;
  if (image.imageSize) ref.imageSize = image.imageSize;
  if (image.thumbnail) ref.thumbnail = image.thumbnail;
  if (image.fileUpdatedAt) ref.fileUpdatedAt = image.fileUpdatedAt;

  if (isFile) {
    ref.file = image.file;
    if (image.imageUrlClient) ref.imageUrlClient = image.imageUrlClient;
  }

  if (!ref.fileName && !ref.file) return null;
  return ref;
}
