import { useEffect, useState } from "react";

import { Box3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import db from "App/db/db";

import renderGlbTopViewDataUrl from "Features/object3D/utils/renderGlbTopViewDataUrl";

// Module-level cache shared by every node: fileName -> dataUrl | Promise
// Annotations created before topViewDataUrl existed only carry a fileName
// reference; the top view is regenerated once per GLB from db.files.
const topViewCache = new Map();

async function generateTopViewFromDb(fileName) {
  const fileRecord = await db.files.get(fileName);
  const arrayBuffer = fileRecord?.fileArrayBuffer;
  if (!arrayBuffer) return null;

  const loader = new GLTFLoader();
  const gltf = await new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, "", resolve, reject);
  });

  const box = new Box3().setFromObject(gltf.scene);
  const bbox = {
    width: box.max.x - box.min.x,
    height: box.max.y - box.min.y,
    depth: box.max.z - box.min.z,
    min: { x: box.min.x, y: box.min.y, z: box.min.z },
    max: { x: box.max.x, y: box.max.y, z: box.max.z },
  };

  return renderGlbTopViewDataUrl({ object3D: gltf.scene, bbox });
}

/**
 * Top-down projection PNG (data URL) for an annotation's object3D field.
 * Returns the persisted topViewDataUrl when present, otherwise lazily
 * generates it from the GLB stored in db.files (cached per fileName).
 */
export default function useObject3DTopView(object3D) {
  const persisted = object3D?.topViewDataUrl ?? null;
  const fileName = object3D?.fileName;

  const cached = !persisted && fileName ? topViewCache.get(fileName) : null;
  const [generated, setGenerated] = useState(
    typeof cached === "string" ? cached : null
  );

  useEffect(() => {
    if (persisted || !fileName) return undefined;

    let cancelled = false;
    let entry = topViewCache.get(fileName);

    if (typeof entry === "string") {
      setGenerated(entry);
      return undefined;
    }

    if (!entry) {
      entry = generateTopViewFromDb(fileName)
        .then((dataUrl) => {
          if (dataUrl) topViewCache.set(fileName, dataUrl);
          else topViewCache.delete(fileName);
          return dataUrl;
        })
        .catch((e) => {
          console.warn("[useObject3DTopView] generation failed", fileName, e);
          topViewCache.delete(fileName);
          return null;
        });
      topViewCache.set(fileName, entry);
    }

    entry.then((dataUrl) => {
      if (!cancelled && dataUrl) setGenerated(dataUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [persisted, fileName]);

  return persisted ?? generated;
}
