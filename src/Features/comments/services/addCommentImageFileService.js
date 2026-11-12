import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import testIsImage from "Features/files/utils/testIsImage";
import resizeImageToLowResolution from "Features/images/utils/resizeImageToLowResolution";
import getImageSizeAsync from "Features/images/utils/getImageSizeAsync";

const MAX_FILE_SIZE = 300 * 1024;

// Stores an image picked / pasted in a comment and returns the props of its
// IMAGE block ({ fileName, imageSize }). The file is written to db.files WITH
// the comment listingId — that is what ships it in the Krto zip (files
// without a relevant listingId are excluded by construction).
export default async function addCommentImageFileService({
  file,
  projectId,
  listingId,
}) {
  if (!file || !testIsImage(file) || !projectId || !listingId) return null;

  const resizedFile =
    (await resizeImageToLowResolution(file, MAX_FILE_SIZE)) ?? file;
  const ext = (file.name?.match(/\.[a-z0-9]+$/i)?.[0] ?? ".png").toLowerCase();
  const fileName = `comment_${nanoid()}${ext}`;

  const imageUrl = URL.createObjectURL(resizedFile);
  let imageSize = null;
  try {
    imageSize = await getImageSizeAsync(imageUrl);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }

  await db.files.add({
    fileName,
    fileMime: resizedFile.type,
    srcFileName: file.name ?? fileName,
    fileArrayBuffer: await resizedFile.arrayBuffer(),
    projectId,
    listingId,
    fileType: "IMAGE",
  });

  return { fileName, imageSize };
}
