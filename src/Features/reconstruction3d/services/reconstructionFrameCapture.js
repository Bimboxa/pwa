import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import ImageObject from "Features/images/js/ImageObject";
import getImageRefFromEntityImage from "Features/imageAnnotations/utils/getImageRefFromEntityImage";

// Screenshot of what the reconstruction player displays, as the image of an
// IMAGE annotation ("photo").
//
// The player (PopperReconstructionPlayer) registers how to grab its current
// picture; the photo row of the player and the RECONSTRUCTION_FRAME commit
// interceptor (a click on the 2D plan while the photo draw is armed) both
// read it from here.

export const RECONSTRUCTION_FRAME_INTERCEPTOR_KEY = "RECONSTRUCTION_FRAME";

const JPEG_QUALITY = 0.92;

let captureProvider = null;

// provider: async () => File | null. Returns the unregister function.
export function registerReconstructionFrameCapture(provider) {
  captureProvider = provider;
  return () => {
    if (captureProvider === provider) captureProvider = null;
  };
}

function getPhotoFileName(extension = "jpg") {
  return `photo_reconstruction_${nanoid(8)}.${extension}`;
}

// The frame the <video> displays, at the resolution of the video.
export async function captureVideoFrameFile(videoElement) {
  const width = videoElement?.videoWidth;
  const height = videoElement?.videoHeight;
  if (!(width > 0 && height > 0)) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(videoElement, 0, 0, width, height);
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob) return null;
  return new File([blob], getPhotoFileName(), { type: "image/jpeg" });
}

// A copy of an image of the reconstruction (photos mode): the annotation
// owns its file, the frame keeps its own.
export async function getFrameImageFile(frame) {
  const fileName = frame?.image?.fileName;
  if (!fileName) return null;
  const record = await db.files.get(fileName);
  const blob =
    record?.fileBlob ??
    (record?.fileArrayBuffer
      ? new Blob([record.fileArrayBuffer], {
          type: record.fileMime || "image/jpeg",
        })
      : null);
  if (!blob) return null;
  const type = blob.type || record?.fileMime || "image/jpeg";
  const extension = type.includes("png") ? "png" : "jpg";
  return new File([blob], getPhotoFileName(extension), { type });
}

// The picture displayed by the player as an annotation image field
// ({file, imageSize, thumbnail…}, stored by the entity pipeline). null
// without a player or a picture.
export async function captureReconstructionFrameImage() {
  const file = await captureProvider?.();
  if (!file) return null;
  const imageObject = await ImageObject.create({ imageFile: file });
  return getImageRefFromEntityImage(imageObject.toEntityField());
}
