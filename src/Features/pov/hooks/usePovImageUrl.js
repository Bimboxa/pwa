import { useState, useEffect } from "react";

import db from "App/db/db";

// Object URL for a POV thumbnail stored in db.files (revoked on cleanup).
export default function usePovImageUrl(fileName) {
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
        type: fileRecord.fileMime || "image/png",
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
