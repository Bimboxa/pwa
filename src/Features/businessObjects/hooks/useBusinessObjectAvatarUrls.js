import { useEffect, useMemo, useState } from "react";

import getNotesAppPhotoThumbnailUrl from "Features/notesApp/services/getNotesAppPhotoThumbnailUrl";
import { pickBusinessObjectMainPhotoNote } from "../utils/resolveBusinessObjectCard";

// Thumbnail URL of the main Krnet photo of each business object, resolved in
// ONE batch at the tree level (no per-row query): {[businessObjectId]: url}.
// Objects without a photo (or with the binary missing locally) are absent.
export default function useBusinessObjectAvatarUrls(
  businessObjects,
  { enabled = true } = {}
) {
  // data

  const fileNameById = useMemo(() => {
    const out = {};
    for (const bo of businessObjects ?? []) {
      const note = pickBusinessObjectMainPhotoNote(bo);
      if (note?.fileName) out[bo.id] = note.fileName;
    }
    return out;
  }, [businessObjects]);
  const pairsKey = Object.entries(fileNameById)
    .map(([id, fileName]) => `${id}:${fileName}`)
    .join("|");

  // state

  const [urlById, setUrlById] = useState({});

  // effects

  useEffect(() => {
    if (!enabled || !pairsKey) {
      setUrlById({});
      return;
    }
    let cancelled = false;
    const entries = Object.entries(fileNameById);
    Promise.all(
      entries.map(([, fileName]) => getNotesAppPhotoThumbnailUrl(fileName))
    ).then((urls) => {
      if (cancelled) return;
      const next = {};
      entries.forEach(([id], i) => {
        if (urls[i]) next[id] = urls[i];
      });
      setUrlById(next);
    });
    return () => {
      cancelled = true;
    };
    // fileNameById is derived from pairsKey
  }, [enabled, pairsKey]);

  return urlById;
}
