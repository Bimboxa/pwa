import { useEffect, useState } from "react";

import db from "App/db/db";

// Object URL of the source video of a 3D reconstruction base map (db.files
// Blob, local to the device), revoked on cleanup.
// → undefined while loading, null when the file is not on this device.
// `version`: bump it to read the file again (video reloaded).
export default function useReconstructionVideoUrl(fileName, version = 0) {
  const [url, setUrl] = useState(undefined);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;

    async function load() {
      if (!fileName) {
        setUrl(null);
        return;
      }
      setUrl(undefined);
      const record = await db.files.get(fileName);
      if (cancelled) return;
      const blob =
        record?.fileBlob ??
        (record?.fileArrayBuffer
          ? new Blob([record.fileArrayBuffer], {
              type: record.fileMime || "video/mp4",
            })
          : null);
      if (!blob) {
        setUrl(null);
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }

    load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileName, version]);

  return url;
}
