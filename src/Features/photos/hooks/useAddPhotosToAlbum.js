import { useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import getDebugAuthFromLocalStorage from "Features/auth/services/getDebugAuthFromLocalStorage";
import testIsImage from "Features/files/utils/testIsImage";
import resizeImageToLowResolution from "Features/images/utils/resizeImageToLowResolution";
import getImageSizeAsync from "Features/images/utils/getImageSizeAsync";
import generateThumbnail from "Features/images/utils/generateThumbnail";

const MAX_FILE_SIZE = 200 * 1024; // same budget as entity images (FieldImageV2)
const THUMBNAIL_SIZE = 128;

// Creates one photo per dropped/selected image file. The main file is written
// to db.files WITH the album listingId — that's what makes it ship in the
// Krto zip (files without a relevant listingId are excluded by construction).
// The photo row keeps an inline dataURL thumbnail for the grid and the map
// hover tooltip. baseMapId is stamped with the current main base map; the
// photo stays unlocalized (point: null) until the "Localiser la photo" tool
// commits a pose.
export default function useAddPhotosToAlbum() {
  const userProfile = useSelector((s) => s.auth.userProfile);

  return async function addPhotosToAlbum({
    files,
    projectId,
    listingId,
    baseMapId,
  }) {
    const imageFiles = (files ?? []).filter((f) => f && testIsImage(f));
    if (!projectId || !listingId || imageFiles.length === 0) return [];

    // createdBy trigram follows the POV / resources pattern
    const debugAuth = getDebugAuthFromLocalStorage();
    const createdBy = {
      idMaster: userProfile?.idMaster ?? debugAuth?.userIdMaster ?? null,
      trigram: userProfile?.trigram ?? debugAuth?.trigram ?? null,
    };

    const photoRecords = [];
    const fileRecords = [];

    for (const file of imageFiles) {
      const id = nanoid();
      const resizedFile = (await resizeImageToLowResolution(
        file,
        MAX_FILE_SIZE
      )) ?? file;
      const fileName = `photo_${id}_${file.name}`;
      const imageUrl = URL.createObjectURL(resizedFile);
      const imageSize = await getImageSizeAsync(imageUrl);
      URL.revokeObjectURL(imageUrl);
      const thumbnail = await generateThumbnail(resizedFile, THUMBNAIL_SIZE);
      const now = new Date().toISOString();

      photoRecords.push({
        id,
        projectId,
        listingId,
        baseMapId: baseMapId ?? null,
        name: file.name,
        point: null,
        directionDeg: null,
        fovDeg: null,
        radiusM: null,
        image: { fileName, imageSize, thumbnail, fileUpdatedAt: now },
        createdBy,
      });

      fileRecords.push({
        fileName,
        fileMime: resizedFile.type,
        srcFileName: file.name,
        fileArrayBuffer: await resizedFile.arrayBuffer(),
        projectId,
        listingId,
        fileType: "IMAGE",
      });
    }

    await db.transaction("rw", db.photos, db.files, async () => {
      await db.files.bulkAdd(fileRecords);
      await db.photos.bulkAdd(photoRecords);
    });

    return photoRecords;
  };
}
