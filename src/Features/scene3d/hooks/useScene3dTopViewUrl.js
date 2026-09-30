import { useEffect, useState } from "react";

import db from "App/db/db";

import { getPendingScene3d } from "../services/scene3dPendingStore";

// Module-level cache shared by every node: fileName → object URL | Promise.
// The top view is read from db.files OUTSIDE the annotations live query (the
// image can weigh several MB — never hydrated on the annotation itself).
const urlCache = new Map();

async function loadTopViewUrl(fileName) {
  const record = await db.files.get(fileName);
  if (!record?.fileArrayBuffer) return null;
  return URL.createObjectURL(
    new Blob([record.fileArrayBuffer], { type: record.fileMime })
  );
}

export function releaseScene3dTopViewUrl(fileName) {
  const entry = urlCache.get(fileName);
  urlCache.delete(fileName);
  if (typeof entry === "string") URL.revokeObjectURL(entry);
}

// Object URL of the top-down projection of a SCENE_3D annotation
// (`scene3d` field), or null while loading / when the image is missing.
// A draft being placed (no file yet) resolves to the pending import's URL.
export default function useScene3dTopViewUrl(scene3d) {
  const fileName = scene3d?.topView?.fileName ?? null;
  const pendingUrl = fileName
    ? null
    : (getPendingScene3d(scene3d?.sceneId)?.topViewUrl ?? null);

  const cached = fileName ? urlCache.get(fileName) : null;
  const [loaded, setLoaded] = useState(
    typeof cached === "string" ? { fileName, url: cached } : null
  );

  useEffect(() => {
    if (!fileName) return undefined;

    let cancelled = false;
    let entry = urlCache.get(fileName);

    if (typeof entry === "string") {
      setLoaded({ fileName, url: entry });
      return undefined;
    }

    if (!entry) {
      entry = loadTopViewUrl(fileName)
        .then((url) => {
          if (url) urlCache.set(fileName, url);
          else urlCache.delete(fileName);
          return url;
        })
        .catch((e) => {
          console.warn("[useScene3dTopViewUrl] load failed", fileName, e);
          urlCache.delete(fileName);
          return null;
        });
      urlCache.set(fileName, entry);
    }

    entry.then((url) => {
      if (!cancelled && url) setLoaded({ fileName, url });
    });

    return () => {
      cancelled = true;
    };
  }, [fileName]);

  if (!fileName) return pendingUrl;
  return loaded?.fileName === fileName ? loaded.url : null;
}
