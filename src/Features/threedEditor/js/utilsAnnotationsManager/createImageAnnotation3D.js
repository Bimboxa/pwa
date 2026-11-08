import { Group } from "three";

import db from "App/db/db";

import getTextureAsync from "../utilsImagesManager/getTextureAsync";

// One texture per image file, shared by every plane showing it and by the
// rebuilds (a render-mode change rebuilds every annotation object). Never
// disposed: AnnotationsManager disposes materials, not their maps.
const texturePromiseByKey = new Map();

function textureKey(image) {
  return `${image.fileName ?? image.imageUrlClient}::${image.fileUpdatedAt ?? ""}`;
}

async function loadImageTexture(image) {
  // db.files is the source of truth (the hydrated blob URL is a session
  // convenience); a template image imported from a remote URL only has
  // imageUrlClient.
  let url = null;
  let revoke = false;
  if (image.fileName) {
    const record = await db.files.get(image.fileName);
    if (record?.fileBlob || record?.fileArrayBuffer) {
      url = URL.createObjectURL(
        record.fileBlob ??
          new Blob([record.fileArrayBuffer], { type: record.fileMime })
      );
      revoke = true;
    }
  }
  if (!url) url = image.imageUrlClient ?? null;
  if (!url) return null;
  try {
    return await getTextureAsync(url);
  } finally {
    if (revoke) URL.revokeObjectURL(url);
  }
}

export function getImageAnnotationTextureAsync(image) {
  if (!image || (!image.fileName && !image.imageUrlClient)) {
    return Promise.resolve(null);
  }
  const key = textureKey(image);
  if (!texturePromiseByKey.has(key)) {
    const promise = loadImageTexture(image);
    promise.catch(() => texturePromiseByKey.delete(key));
    texturePromiseByKey.set(key, promise);
  }
  return texturePromiseByKey.get(key);
}

// The photo card is built by ThreedAnnotationLabels beneath this managed
// root. Keeping a root preserves annotation visibility, solo and lifecycle.
export default function createImageAnnotation3D(annotation) {
  if (!annotation?.bbox || !annotation?.image) return null;
  const root = new Group();
  root.userData.noVertexSnap = true;
  return root;
}
