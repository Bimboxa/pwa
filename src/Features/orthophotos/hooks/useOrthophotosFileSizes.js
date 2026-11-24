import { useEffect, useMemo, useRef } from "react";

import db from "App/db/db";

const IMAGE_KEYS = ["orthoImage", "sourceImage"];

// Byte sizes of the image files of the orthophotos: { orthoBytes,
// sourceBytes, complete }. Read from `image.fileSize`, stored on the row when
// the file is written; rows created before that field are measured once from
// db.files and the size is persisted on them (`complete` is false meanwhile).
export default function useOrthophotosFileSizes(orthophotos) {
  const measuredRef = useRef(new Set());

  const sizes = useMemo(() => {
    let orthoBytes = 0;
    let sourceBytes = 0;
    let complete = true;
    for (const orthophoto of orthophotos) {
      for (const key of IMAGE_KEYS) {
        const image = orthophoto[key];
        if (!image?.fileName) continue;
        if (!Number.isFinite(image.fileSize)) {
          complete = false;
          continue;
        }
        if (key === "orthoImage") orthoBytes += image.fileSize;
        else sourceBytes += image.fileSize;
      }
    }
    return { orthoBytes, sourceBytes, complete };
  }, [orthophotos]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const orthophoto of orthophotos) {
        for (const key of IMAGE_KEYS) {
          const image = orthophoto[key];
          if (!image?.fileName || Number.isFinite(image.fileSize)) continue;
          if (measuredRef.current.has(image.fileName)) continue;
          measuredRef.current.add(image.fileName);
          const record = await db.files.get(image.fileName);
          if (cancelled) return;
          // a file absent from this device weighs nothing in an archive
          await db.orthophotos.update(orthophoto.id, {
            [`${key}.fileSize`]: record?.fileArrayBuffer?.byteLength ?? 0,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orthophotos]);

  return sizes;
}
