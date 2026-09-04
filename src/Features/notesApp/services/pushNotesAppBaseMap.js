import { nanoid } from "@reduxjs/toolkit";

import db, { withSystemWrite } from "App/db/db";
import { withoutUndo } from "App/db/undoManager";

import { getNotesAppClient } from "./notesAppClient";
import { getNotesAppSession } from "./notesAppAuthService";

// Pushes ONE base map to Krnet: the ACTIVE version's image only. Follows the
// mobile app's storage convention ({projectId}/basemaps/{id}_full_{ts}.{ext}
// + derived {id}_thumb_{ts}.jpg, 800px JPEG 80%) and upserts the base_maps
// row (snake_case, unix-second timestamps). A Bimboxa-authored map gets a
// fresh Krnet nanoid, stored locally as idMaster: from then on it merges
// like an imported map on both sides.

function getExtension(fileName, mime) {
  const fromName = fileName?.includes(".") ? fileName.split(".").pop() : null;
  if (fromName) return fromName.toLowerCase();
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

function getMimeType(ext, fallback) {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return fallback ?? "application/octet-stream";
}

// 800px-wide JPEG thumbnail (mobile parity). Best effort: a failure must not
// block the main image push.
async function makeThumbBlob(fileArrayBuffer, mime) {
  const blob = new Blob([fileArrayBuffer], { type: mime });
  const bitmap = await createImageBitmap(blob);
  const width = Math.min(800, bitmap.width);
  const height = Math.round((bitmap.height * width) / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  return new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.8)
  );
}

export default async function pushNotesAppBaseMap({ baseMap, notesAppProjectId }) {
  if (!baseMap?.id) throw new Error("baseMap missing");
  if (!notesAppProjectId) throw new Error("notesApp projectId missing");

  const session = await getNotesAppSession();
  if (!session) {
    const error = new Error("Not signed in to notes-app");
    error.code = "NOTES_APP_NOT_SIGNED_IN";
    throw error;
  }
  const client = getNotesAppClient();

  // --- active version's image (fallback: the base map's own image)
  const versions = await db.baseMapVersions
    .where("baseMapId")
    .equals(baseMap.id)
    .toArray();
  const activeVersion =
    versions.find((v) => v.isActive && !v.deletedAt) ??
    versions.find((v) => !v.deletedAt);
  const image = activeVersion?.image ?? baseMap.image;
  if (!image?.fileName) throw new Error("Le fond de plan n'a pas d'image");

  const fileRow = await db.files.get(image.fileName);
  if (!fileRow?.fileArrayBuffer?.byteLength) {
    throw new Error("Image introuvable en local");
  }

  const remoteId = baseMap.idMaster ?? nanoid();
  const isNew = !baseMap.idMaster;
  const ts = Date.now();
  const ext = getExtension(image.fileName, fileRow.fileMime);
  const contentType = getMimeType(ext, fileRow.fileMime);
  const storagePath = `${notesAppProjectId}/basemaps/${remoteId}_full_${ts}.${ext}`;

  // --- full image
  const { error: uploadError } = await client.storage
    .from("project-files")
    .upload(storagePath, fileRow.fileArrayBuffer, { contentType, upsert: true });
  if (uploadError) throw uploadError;

  // --- thumbnail (best effort, mobile lists rely on it)
  try {
    const thumbBlob = await makeThumbBlob(fileRow.fileArrayBuffer, contentType);
    if (thumbBlob) {
      const thumbPath = `${notesAppProjectId}/basemaps/${remoteId}_thumb_${ts}.jpg`;
      await client.storage
        .from("project-files")
        .upload(thumbPath, thumbBlob, { contentType: "image/jpeg", upsert: true });
    }
  } catch (e) {
    console.warn("[notesApp] thumbnail push failed", e);
  }

  // --- base_maps row (snake_case, unix SECONDS)
  const nowSec = Math.floor(ts / 1000);
  const row = {
    id: remoteId,
    project_id: notesAppProjectId,
    name: baseMap.name ?? "Plan",
    image_storage_path: storagePath,
    updated_at: nowSec,
    ...(isNew && {
      created_at: nowSec,
      created_by: session.user?.id ?? null,
    }),
  };
  const { error: upsertError } = await client
    .from("base_maps")
    .upsert(row, { onConflict: "id" });
  if (upsertError) throw upsertError;

  // --- local bookkeeping (system write: not a user edit, keep the scope
  // clean and the merge cursors consistent)
  await withSystemWrite(() =>
    withoutUndo(() =>
      db.baseMaps.update(baseMap.id, {
        idMaster: remoteId,
        remoteSource: "notesApp",
        notesAppStoragePath: storagePath,
        remoteUpdatedAt: nowSec * 1000,
      })
    )
  );

  return { remoteId, storagePath };
}
