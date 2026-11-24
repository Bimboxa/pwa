import { nanoid } from "@reduxjs/toolkit";

import db from "App/db/db";

import generateThumbnail from "Features/images/utils/generateThumbnail";
import getImageSizeAsync from "Features/images/utils/getImageSizeAsync";

import { RECONSTRUCTION_MEDIA_TYPES } from "../constants/reconstruction3dTool";

// Write side of db.reconstructionFrames (see the schema comment in
// App/db/db.js) and of the source video of a 3D reconstruction base map.

const THUMBNAIL_SIZE = 128;
const VIDEO_FILE_TYPE = "VIDEO";

function sanitizeFileName(name) {
  return String(name ?? "file").replace(/[^\w.-]+/g, "_");
}

export function getReconstructionFrameName(index) {
  return `F${String(index + 1).padStart(3, "0")}`;
}

export function sortReconstructionFrames(rows) {
  return [...rows].sort(
    (a, b) =>
      (a.index ?? 0) - (b.index ?? 0) ||
      (a.name || "").localeCompare(b.name || "")
  );
}

export async function getReconstructionFramesOfBaseMap(baseMapId) {
  if (!baseMapId) return [];
  const rows = await db.reconstructionFrames
    .where("baseMapId")
    .equals(baseMapId)
    .filter((r) => !r.deletedAt)
    .toArray();
  return sortReconstructionFrames(rows);
}

// An image that got its camera from the Prompt IA result.
export function hasReconstructionPose(frame) {
  return (
    Array.isArray(frame?.pose?.position) && Array.isArray(frame?.pose?.forward)
  );
}

async function buildFrameImageAsync({
  file,
  frameId,
  imageSize: knownImageSize,
  projectId,
  listingId,
  baseMapId,
}) {
  const fileName = `reconstruction3d_frame_${frameId}_${sanitizeFileName(file.name)}`;
  let imageSize = knownImageSize;
  if (!imageSize) {
    const url = URL.createObjectURL(file);
    try {
      imageSize = await getImageSizeAsync(url);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return {
    image: {
      fileName,
      fileSize: file.size ?? null,
      imageSize,
      thumbnail: await generateThumbnail(file, THUMBNAIL_SIZE),
      fileUpdatedAt: new Date().toISOString(),
    },
    // The file carries the BASE MAP listingId, but createKrtoZip leaves the
    // reconstruction images out (local data).
    fileRecord: {
      fileName,
      fileMime: file.type || "image/jpeg",
      srcFileName: file.name,
      fileArrayBuffer: await file.arrayBuffer(),
      fileType: "IMAGE",
      projectId,
      listingId,
      entityId: baseMapId,
      listingTable: "baseMaps",
    },
  };
}

/**
 * Adds images to ONE reconstruction base map, after the existing ones, in a
 * single transaction.
 *
 * @param {Object} params
 * @param {{id, projectId, listingId}} params.baseMap
 * @param {Array<{file: File, timeS?: number, imageSize?: Object}>} params.items
 * @param {(ratio: number) => void} [params.onProgress]
 * @returns {Promise<Object[]>} the new rows
 */
export async function addReconstructionFramesService({
  baseMap,
  items,
  onProgress,
}) {
  const { id: baseMapId, projectId, listingId } = baseMap ?? {};
  if (!baseMapId || !projectId || !items?.length) return [];

  const existing = await getReconstructionFramesOfBaseMap(baseMapId);
  let index = existing.length
    ? Math.max(...existing.map((f) => f.index ?? 0)) + 1
    : 0;

  const rows = [];
  const fileRecords = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item?.file) continue;
    const id = nanoid();
    const { image, fileRecord } = await buildFrameImageAsync({
      file: item.file,
      frameId: id,
      imageSize: item.imageSize,
      projectId,
      listingId,
      baseMapId,
    });
    fileRecords.push(fileRecord);
    rows.push({
      id,
      projectId,
      listingId: listingId ?? null,
      baseMapId,
      name: getReconstructionFrameName(index),
      index,
      timeS: Number.isFinite(item.timeS) ? item.timeS : null,
      image,
      pose: null,
    });
    index += 1;
    onProgress?.((i + 1) / items.length);
  }
  if (rows.length === 0) return [];

  await db.transaction("rw", db.reconstructionFrames, db.files, async () => {
    await db.files.bulkAdd(fileRecords);
    await db.reconstructionFrames.bulkAdd(rows);
  });
  return rows;
}

// Soft-deletes the row (middleware) and deletes its image file — nothing
// else references the blob (db.files is not soft-deleted).
export async function deleteReconstructionFrameService(frame) {
  if (!frame?.id) return;
  await db.transaction("rw", db.reconstructionFrames, db.files, async () => {
    await db.reconstructionFrames.delete(frame.id);
    if (frame.image?.fileName) await db.files.delete(frame.image.fileName);
  });
}

// Empties the media of a reconstruction base map: its images and its video.
// The loaded model (baseMap.scene3d + image) is left alone — it stays until
// the next result is loaded.
export async function clearReconstructionMediaService(baseMapId) {
  if (!baseMapId) return;
  const record = await db.baseMaps.get(baseMapId);
  const frames = await getReconstructionFramesOfBaseMap(baseMapId);
  const fileNames = [
    ...frames.map((f) => f.image?.fileName),
    record?.reconstruction3d?.video?.fileName,
  ].filter(Boolean);
  await db.transaction(
    "rw",
    [db.reconstructionFrames, db.files, db.baseMaps],
    async () => {
      if (frames.length > 0)
        await db.reconstructionFrames.bulkDelete(frames.map((f) => f.id));
      if (fileNames.length > 0) await db.files.bulkDelete(fileNames);
      if (record)
        await db.baseMaps.update(baseMapId, { reconstruction3d: null });
    }
  );
}

function getVideoFileName(baseMapId, file) {
  return `reconstruction3d_video_${baseMapId}_${nanoid(6)}_${sanitizeFileName(file.name)}`;
}

async function putVideoFile({ fileName, file, projectId }) {
  // The Blob as is, no listing: local to the device (never in the Krto zip,
  // never synced) — same row shape as the GLB of a scan base map.
  await db.files.put({
    fileName,
    fileBlob: file,
    projectId,
    fileMime: file.type || "video/mp4",
    srcFileName: file.name,
    fileType: VIDEO_FILE_TYPE,
  });
}

/**
 * Records the media of a reconstruction base map
 * (baseMap.reconstruction3d): a video — its file is stored — or photos.
 *
 * @param {Object} params
 * @param {string} params.baseMapId
 * @param {string} params.projectId
 * @param {"VIDEO"|"PHOTOS"} params.mediaType
 * @param {File} [params.videoFile]
 * @param {{durationS, width, height, intervalS}} [params.videoInfo]
 */
export async function setReconstructionMediaService({
  baseMapId,
  projectId,
  mediaType,
  videoFile = null,
  videoInfo = null,
}) {
  if (mediaType !== RECONSTRUCTION_MEDIA_TYPES.VIDEO || !videoFile) {
    await db.baseMaps.update(baseMapId, {
      reconstruction3d: {
        mediaType: RECONSTRUCTION_MEDIA_TYPES.PHOTOS,
        video: null,
      },
    });
    return;
  }
  const fileName = getVideoFileName(baseMapId, videoFile);
  await db.transaction("rw", [db.files, db.baseMaps], async () => {
    await putVideoFile({ fileName, file: videoFile, projectId });
    await db.baseMaps.update(baseMapId, {
      reconstruction3d: {
        mediaType: RECONSTRUCTION_MEDIA_TYPES.VIDEO,
        video: {
          fileName,
          srcFileName: videoFile.name,
          fileSize: videoFile.size,
          durationS: videoInfo?.durationS ?? null,
          width: videoInfo?.width ?? null,
          height: videoInfo?.height ?? null,
        },
        sampleIntervalS: videoInfo?.intervalS ?? null,
      },
    });
  });
}

// « Recharger la vidéo »: the video file is local to the device — on another
// one (Krto / project import) the player asks for it again. The frames and
// their cameras are kept: the file must be the same video.
export async function reloadReconstructionVideoService({ baseMapId, file }) {
  const record = await db.baseMaps.get(baseMapId);
  const previous = record?.reconstruction3d;
  if (!record || previous?.mediaType !== RECONSTRUCTION_MEDIA_TYPES.VIDEO)
    throw new Error("Ce fond de plan n'a pas de vidéo.");
  const fileName = getVideoFileName(baseMapId, file);
  const previousFileName = previous.video?.fileName;
  await db.transaction("rw", [db.files, db.baseMaps], async () => {
    await putVideoFile({ fileName, file, projectId: record.projectId });
    await db.baseMaps.update(baseMapId, {
      reconstruction3d: {
        ...previous,
        video: {
          ...previous.video,
          fileName,
          srcFileName: file.name,
          fileSize: file.size,
        },
      },
    });
    if (previousFileName && previousFileName !== fileName)
      await db.files.delete(previousFileName);
  });
}
