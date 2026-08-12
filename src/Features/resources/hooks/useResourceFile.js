import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

// Resolves a resource's main file from db.files. `fileIsMissing` is the
// post-Krto-import state: the metadata row shipped in the zip but the main
// file did not — the detail panel then offers to re-attach it locally. Live
// query so a re-attach updates the view in place.
export default function useResourceFile(resource) {
  const fileName = resource?.fileName;

  const fileRecord = useLiveQuery(async () => {
    if (!fileName) return null;
    return (await db.files.get(fileName)) ?? null;
  }, [fileName]);

  const file = useMemo(() => {
    if (!fileRecord?.fileArrayBuffer) return null;
    return new File(
      [fileRecord.fileArrayBuffer],
      resource?.name ?? fileRecord.srcFileName ?? "file",
      { type: fileRecord.fileMime || "application/octet-stream" }
    );
  }, [fileRecord, resource?.name]);

  const loading = fileRecord === undefined;

  return {
    file,
    loading,
    fileIsMissing: !loading && !file,
  };
}
