import {
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from "three";

import db from "App/db/db";

import getTextureAsync from "../utilsImagesManager/getTextureAsync";
import pixelToWorld from "./pixelToWorld";

// Lift above the base map plane (basemap-local Z, metres) so the picture
// never z-fights with the plane it lies on.
const IMAGE_LIFT_M = 0.01;

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
    if (record?.fileArrayBuffer) {
      url = URL.createObjectURL(
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

// IMAGE annotation in 3D: a flat textured plane lying on the base map, at the
// bbox footprint (base-map px → metres) and the 2D rotation about the bbox
// centre — the same pose as OBJECT_3D (createObject3DAnnotation). The plane
// is returned synchronously (hidden) and shown once its texture is loaded.
export default function createImageAnnotation3D(annotation, baseMap, options) {
  const bbox = annotation?.bbox;
  const image = annotation?.image;
  if (!bbox || !(bbox.width > 0) || !(bbox.height > 0)) return null;
  if (!image?.fileName && !image?.imageUrlClient) return null;

  const meterByPx = baseMap?.meterByPx;
  if (!(meterByPx > 0)) return null;

  const widthM = bbox.width * meterByPx;
  const heightM = bbox.height * meterByPx;

  const material = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.02,
    opacity: Number.isFinite(annotation.opacity) ? annotation.opacity : 1,
    side: DoubleSide,
    depthWrite: true,
    toneMapped: false,
  });
  // PlaneGeometry UVs put the texture top at +Y; basemap-local Y points up
  // (pixelToWorld mirrors image y), so the picture reads like the 2D map.
  const mesh = new Mesh(new PlaneGeometry(widthM, heightM), material);
  mesh.visible = false;
  mesh.userData.isImageAnnotation = true;

  const outer = new Group();
  const center = pixelToWorld(
    { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 },
    baseMap
  );
  outer.position.set(
    center.x,
    center.y,
    (Number(annotation.offsetZ) || 0) + IMAGE_LIFT_M
  );
  // SVG rotation is clockwise on screen; pixelToWorld mirrors y, so it is
  // -θ about basemap-local Z (same convention as OBJECT_3D).
  outer.rotation.z = MathUtils.degToRad(-(annotation.rotation || 0));
  outer.add(mesh);

  getImageAnnotationTextureAsync(image)
    .then((texture) => {
      // Object removed before the texture arrived: nothing to show.
      if (!texture || !outer.parent) return;
      material.map = texture;
      material.needsUpdate = true;
      mesh.visible = true;
      options?.onAsyncLoaded?.();
    })
    .catch((err) => {
      console.error("[IMAGE] failed to load texture", err);
    });

  return outer;
}
