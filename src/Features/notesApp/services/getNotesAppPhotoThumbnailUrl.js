import db from "App/db/db";

import generateThumbnail from "Features/images/utils/generateThumbnail";

// Small square thumbnail of a Krnet photo note stored in db.files (avatar of
// the business-object list rows). Resolved once per fileName and cached for
// the app lifetime (data URLs, ~96px webp — bounded by the number of
// photos). A missing / empty file resolves null and is NOT cached: a later
// sync can bring the binary.
const THUMB_SIZE = 96;
const cache = new Map(); // fileName -> Promise<string>

export default function getNotesAppPhotoThumbnailUrl(fileName) {
  if (!fileName) return Promise.resolve(null);
  const cached = cache.get(fileName);
  if (cached) return cached;

  const promise = (async () => {
    const file = await db.files.get(fileName);
    if (!file?.fileArrayBuffer?.byteLength) return null;
    const blob = new Blob([file.fileArrayBuffer], { type: file.fileMime });
    try {
      return await generateThumbnail(
        new File([blob], fileName, { type: blob.type }),
        THUMB_SIZE
      );
    } catch (e) {
      console.warn("[notesApp] thumbnail failed, full image used", fileName, e);
      return URL.createObjectURL(blob);
    }
  })();

  cache.set(fileName, promise);
  promise.then(
    (url) => {
      if (!url) cache.delete(fileName);
    },
    () => cache.delete(fileName)
  );
  return promise;
}
