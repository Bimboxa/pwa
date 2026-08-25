import { useState, useEffect } from "react";

import db from "App/db/db";

// Object URL for a photo file stored in db.files (revoked on cleanup).
// Same pattern as usePovImageUrl.
export default function usePhotoImageUrl(fileName) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;

    async function load() {
      if (!fileName) {
        setUrl(null);
        return;
      }
      const fileRecord = await db.files.get(fileName);
      if (cancelled || !fileRecord?.fileArrayBuffer) {
        setUrl(null);
        return;
      }
      const blob = new Blob([fileRecord.fileArrayBuffer], {
        type: fileRecord.fileMime || "image/jpeg",
      });
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }

    load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileName]);

  return url;
}
