import { nanoid } from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";

import getImageSizeAsync from "Features/images/utils/getImageSizeAsync";
import generateThumbnail from "Features/images/utils/generateThumbnail";

// Write side of db.orthophotos (see the schema comment in App/db/db.js).
// Plain async services: used by the Orthophotos tool AND by the Prompt IA
// import (createOrthophotoBaseMapsFromPromptIaService).

const THUMBNAIL_SIZE = 128;

function sanitizeFileName(name) {
  return String(name ?? "image").replace(/[^\w.-]+/g, "_");
}

// {image descriptor stored on the row, db.files record} of one image file.
// `role`: "ortho" | "source". The file carries the BASE MAP listingId: that
// is what ships it in the Krto zip.
export async function buildOrthophotoImageAsync({
  file,
  role,
  orthophotoId,
  projectId,
  listingId,
  baseMapId,
}) {
  const fileName = `orthophoto_${role}_${orthophotoId}_${nanoid(6)}_${sanitizeFileName(file.name)}`;
  const url = URL.createObjectURL(file);
  let imageSize;
  try {
    imageSize = await getImageSizeAsync(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  const thumbnail = await generateThumbnail(file, THUMBNAIL_SIZE);
  return {
    image: {
      fileName,
      imageSize,
      thumbnail,
      fileUpdatedAt: new Date().toISOString(),
    },
    fileRecord: {
      fileName,
      fileMime: file.type || "image/png",
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

export async function getOrthophotosOfBaseMap(baseMapId) {
  if (!baseMapId) return [];
  const rows = await db.orthophotos
    .where("baseMapId")
    .equals(baseMapId)
    .filter((r) => !r.deletedAt)
    .toArray();
  return sortOrthophotos(rows);
}

// A photo added from « Ajouter des photos », not rectified yet: it has its
// original image only, and waits for the Prompt IA result.
export function isPendingOrthophoto(orthophoto) {
  return !orthophoto?.orthoImage?.fileName;
}

export function sortOrthophotos(rows) {
  return [...rows].sort(
    (a, b) =>
      (a.fractionalIndex || "").localeCompare(b.fractionalIndex || "") ||
      (a.name || "").localeCompare(b.name || "")
  );
}

// "P01", "P02"… — first free number among the existing names.
export function getNextOrthophotoName(orthophotos) {
  const used = new Set((orthophotos ?? []).map((o) => o.name));
  for (let i = (orthophotos?.length ?? 0) + 1; ; i++) {
    const name = `P${String(i).padStart(2, "0")}`;
    if (!used.has(name)) return name;
  }
}

// Adds several orthophotos to ONE base map in a single transaction.
// items: [{name, sourceFile, orthoFile, station: {x,y}, corners: [4 × {x,y}]}]
// (station / corners normalized [0..1] on the base map reference image).
// An item with a `sourceFile` only is a PENDING photo (no rectified image,
// station nor corners yet — see isPendingOrthophoto).
export async function addOrthophotosService({ baseMap, items }) {
  const { id: baseMapId, projectId, listingId } = baseMap ?? {};
  if (!baseMapId || !projectId || !items?.length) return [];

  const existing = await getOrthophotosOfBaseMap(baseMapId);
  let lastIndex = existing.length
    ? existing[existing.length - 1].fractionalIndex || null
    : null;

  const rows = [];
  const fileRecords = [];
  for (const item of items) {
    if (!item?.orthoFile && !item?.sourceFile) continue;
    const id = nanoid();
    // no rectified image yet: a photo waiting for the Prompt IA round trip
    let orthoImage = null;
    if (item.orthoFile) {
      const ortho = await buildOrthophotoImageAsync({
        file: item.orthoFile,
        role: "ortho",
        orthophotoId: id,
        projectId,
        listingId,
        baseMapId,
      });
      fileRecords.push(ortho.fileRecord);
      orthoImage = ortho.image;
    }
    let sourceImage = null;
    if (item.sourceFile) {
      const source = await buildOrthophotoImageAsync({
        file: item.sourceFile,
        role: "source",
        orthophotoId: id,
        projectId,
        listingId,
        baseMapId,
      });
      fileRecords.push(source.fileRecord);
      sourceImage = source.image;
    }
    lastIndex = generateKeyBetween(lastIndex, null);
    rows.push({
      id,
      projectId,
      listingId: listingId ?? null,
      baseMapId,
      name: item.name,
      fractionalIndex: lastIndex,
      station: item.station ?? null,
      corners: item.corners ?? null,
      orthoImage,
      sourceImage,
    });
  }
  if (rows.length === 0) return [];

  await db.transaction("rw", db.orthophotos, db.files, async () => {
    await db.files.bulkAdd(fileRecords);
    await db.orthophotos.bulkAdd(rows);
  });
  return rows;
}

// Replaces the rectified ("ortho") or the original ("source") image.
// Returns the new image descriptor.
export async function replaceOrthophotoImageService({
  orthophoto,
  role,
  file,
}) {
  if (!orthophoto?.id || !file) return;
  const key = role === "source" ? "sourceImage" : "orthoImage";
  const { image, fileRecord } = await buildOrthophotoImageAsync({
    file,
    role,
    orthophotoId: orthophoto.id,
    projectId: orthophoto.projectId,
    listingId: orthophoto.listingId,
    baseMapId: orthophoto.baseMapId,
  });
  const previousFileName = orthophoto[key]?.fileName;
  await db.transaction("rw", db.orthophotos, db.files, async () => {
    await db.files.add(fileRecord);
    await db.orthophotos.update(orthophoto.id, { [key]: image });
    if (previousFileName) await db.files.delete(previousFileName);
  });
  return image;
}

// Soft-deletes the row (middleware) and deletes its two image files —
// nothing else references the blobs (db.files is not soft-deleted).
export async function deleteOrthophotoService(orthophoto) {
  if (!orthophoto?.id) return;
  const fileNames = [
    orthophoto.orthoImage?.fileName,
    orthophoto.sourceImage?.fileName,
  ].filter(Boolean);
  await db.transaction("rw", db.orthophotos, db.files, async () => {
    await db.orthophotos.delete(orthophoto.id);
    if (fileNames.length > 0) await db.files.bulkDelete(fileNames);
  });
}
