import JSZip from "jszip";
import { nanoid } from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";

import downloadBlob from "Features/files/utils/downloadBlob";
import generateThumbnail from "Features/images/utils/generateThumbnail";
import getImageSizeAsync from "Features/images/utils/getImageSizeAsync";
import { slugify } from "Features/promptIa/services/buildPromptIaZip";
import { isIgnoredPath } from "Features/promptIaProject/utils/readDroppedEntries";
import { normalizeZipPath } from "Features/promptIaProject/utils/parsePromptIaProjectOutput";
import { testIsWhitePageImage } from "Features/baseMaps/utils/createWhitePageImage";

import instructionsBody from "../docs/PROMPT_IA_ORTHOPHOTO_INSTRUCTIONS.md?raw";
import parseOrthophotoPromptOutput from "../utils/parseOrthophotoPromptOutput";
import {
  addOrthophotosService,
  buildOrthophotoImageAsync,
  getNextOrthophotoName,
  getOrthophotosOfBaseMap,
  isPendingOrthophoto,
} from "./orthophotoServices";

// « Ajouter des photos » of the Orthophotos tool — the Prompt IA round trip
// that turns the photos of an orthomosaic base map into its mosaic:
//   1. the dropped photos become PENDING db.orthophotos rows (original image
//      only);
//   2. buildOrthophotoPromptZip: INSTRUCTIONS.md + contexte.json + the
//      photos (+ the current mosaic) for an external AI chat;
//   3. readOrthophotoResultZip + applyOrthophotoResultService: the returned
//      zip (orthophoto.json + mosaic + unit orthophotos) replaces the base
//      map image and fills the rows.
// See docs/baseMaps/ORTHOPHOTOS.md.

const IMAGE_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};
const getExtension = (name) =>
  String(name ?? "")
    .split(".")
    .pop()
    .toLowerCase();
export const getImageType = (name) => IMAGE_TYPES[getExtension(name)] ?? null;
const isZip = (file) =>
  getExtension(file?.name) === "zip" ||
  file?.type === "application/zip" ||
  file?.type === "application/x-zip-compressed";

const naturalCompare = (a, b) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/**
 * Photos of a drop / a file pick: plain images, the images of the dropped
 * folders and the images of the dropped zips, in natural path order.
 *
 * @param {Array<{path: string, file: File}>} entries
 * @returns {Promise<{files: File[], skipped: string[]}>} `skipped`: paths
 *   that are not PNG / JPEG / WebP images (HEIC, raw files, documents…)
 */
export async function readPhotoFilesFromEntries(entries = []) {
  const photos = [];
  const skipped = [];
  for (const entry of entries) {
    if (!entry?.file || isIgnoredPath(entry.path)) continue;
    if (isZip(entry.file)) {
      let zip;
      try {
        zip = await JSZip.loadAsync(entry.file);
      } catch {
        skipped.push(entry.path);
        continue;
      }
      for (const zipFile of Object.values(zip.files)) {
        const path = normalizeZipPath(zipFile.name);
        if (zipFile.dir || isIgnoredPath(path)) continue;
        const type = getImageType(path);
        if (!type) {
          skipped.push(`${entry.path}/${path}`);
          continue;
        }
        const blob = await zipFile.async("blob");
        photos.push({
          path: `${entry.path}/${path}`,
          file: new File([blob], path.split("/").pop(), { type }),
        });
      }
      continue;
    }
    if (getImageType(entry.file.name) || getImageType(entry.path)) {
      photos.push({ path: entry.path, file: entry.file });
    } else {
      skipped.push(entry.path);
    }
  }
  photos.sort((a, b) => naturalCompare(a.path, b.path));
  return { files: photos.map((p) => p.file), skipped };
}

// Adds the photos to the base map as PENDING orthophotos, named after the
// existing ones ("P01", "P02"…), in one transaction.
export async function addPendingPhotosService({ baseMap, files }) {
  if (!baseMap?.id || !files?.length) return [];
  const existing = await getOrthophotosOfBaseMap(baseMap.id);
  const named = [...existing];
  const items = files.map((sourceFile) => {
    const name = getNextOrthophotoName(named);
    named.push({ name });
    return { name, sourceFile };
  });
  return addOrthophotosService({ baseMap, items });
}

export async function readStoredFile(fileName) {
  if (!fileName) return null;
  const record = await db.files.get(fileName);
  if (!record?.fileArrayBuffer) return null;
  return {
    blob: new Blob([record.fileArrayBuffer], {
      type: record.fileMime || "application/octet-stream",
    }),
    extension:
      Object.keys(IMAGE_TYPES).find(
        (ext) => IMAGE_TYPES[ext] === record.fileMime
      ) ?? getExtension(record.srcFileName ?? fileName),
  };
}

function buildInstructionsMarkdown(context) {
  const { baseMap, photos } = context;
  const newCount = photos.filter((p) => p.status === "NEW").length;
  const lines = [
    `# Orthomosaïque — ${baseMap.name}`,
    "",
    "> Suis ces instructions jusqu'au bout, puis renvoie le zip demandé dans",
    "> la section « Forme de la réponse ».",
    "",
    "## Demande",
    "",
    `**Fond de plan** : ${baseMap.name}`,
    "",
    baseMap.mosaic
      ? `Le fond de plan a déjà une mosaïque (\`${baseMap.mosaic.file}\`, ${baseMap.mosaic.width} × ${baseMap.mosaic.height} px) : ajoute-lui les ${newCount} nouvelle(s) photo(s) en conservant son cadre.`
      : `Le fond de plan est vide : assemble les ${photos.length} photo(s) en une orthomosaïque.`,
    "",
    "**Fichiers**",
    "",
    "- `contexte.json` — données de la demande (à lire en premier)",
    ...(baseMap.mosaic
      ? [`- \`${baseMap.mosaic.file}\` — mosaïque actuelle`]
      : []),
    ...photos.map(
      (p) =>
        `- \`${p.file}\` — ${p.name}${p.status === "PLACED" ? " (déjà assemblée)" : ""}`
    ),
    "",
    "---",
    "",
    instructionsBody.trim(),
    "",
  ];
  return lines.join("\n");
}

/**
 * Builds (and downloads) `prompt-ia-orthophoto-<name>.zip`: INSTRUCTIONS.md,
 * contexte.json, the original photos under `donnees/photos/` and the current
 * mosaic of the base map when it has one.
 *
 * @param {Object} params
 * @param {Object} params.baseMap - hydrated BaseMap
 * @param {boolean} [params.download=true]
 * @returns {Promise<{ok: true, fileName, sizeBytes, photosCount, missing: string[], blob}
 *   | {ok: false, error: string}>} `missing`: photos whose original file is
 *   not on this device (left out of the zip)
 */
export async function buildOrthophotoPromptZip({ baseMap, download = true }) {
  if (!baseMap?.id) return { ok: false, error: "Aucun fond de plan." };
  // the photos unchecked in the tool are left out of the request
  const orthophotos = (await getOrthophotosOfBaseMap(baseMap.id)).filter(
    (o) => !o.isExcluded
  );

  const zip = new JSZip();
  const photos = [];
  const missing = [];
  for (const orthophoto of orthophotos) {
    const stored = await readStoredFile(orthophoto.sourceImage?.fileName);
    if (!stored) {
      missing.push(orthophoto.name);
      continue;
    }
    const file = `donnees/photos/${orthophoto.name}.${stored.extension}`;
    zip.file(file, stored.blob, { compression: "STORE" });
    const pending = isPendingOrthophoto(orthophoto);
    photos.push({
      name: orthophoto.name,
      file,
      width: orthophoto.sourceImage.imageSize?.width ?? null,
      height: orthophoto.sourceImage.imageSize?.height ?? null,
      status: pending ? "NEW" : "PLACED",
      ...(!pending && {
        station: orthophoto.station ?? null,
        corners: orthophoto.corners ?? null,
      }),
    });
  }
  if (photos.length === 0)
    return { ok: false, error: "Aucune photo d'origine à envoyer." };

  // current mosaic: the active image, unless the base map is still blank
  let mosaic = null;
  const record = await db.baseMaps.get(baseMap.id);
  const versions = (
    await db.baseMapVersions.where("baseMapId").equals(baseMap.id).toArray()
  ).filter((v) => !v.deletedAt);
  const activeImage =
    (versions.find((v) => v.isActive) ?? versions[0])?.image ?? record?.image;
  if (activeImage?.fileName && !testIsWhitePageImage(activeImage)) {
    const stored = await readStoredFile(activeImage.fileName);
    if (stored) {
      const file = `donnees/mosaique.${stored.extension}`;
      zip.file(file, stored.blob, { compression: "STORE" });
      mosaic = {
        file,
        width: activeImage.imageSize?.width ?? null,
        height: activeImage.imageSize?.height ?? null,
      };
    }
  }

  const context = {
    kind: "ORTHOPHOTO",
    baseMap: {
      name: baseMap.name || "Orthophoto",
      mosaic,
      // only meaningful while the frame of the mosaic is kept
      meterByPx: mosaic ? (record?.meterByPx ?? null) : null,
    },
    photos,
    output: {
      zipEntries: [
        "orthophoto.json",
        "orthophotos/mosaique.png",
        "orthophotos/unitaires/<nom>.png",
      ],
      rootKeys: ["version", "orthophoto", "note"],
      photoNames: photos.map((p) => p.name),
      coordinates:
        "normalized [0..1] in the mosaic image, origin top-left, x right, y down",
      cornersOrder: ["topLeft", "topRight", "bottomRight", "bottomLeft"],
    },
  };

  zip.file("INSTRUCTIONS.md", buildInstructionsMarkdown(context));
  zip.file("contexte.json", JSON.stringify(context, null, 2));
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    streamFiles: true,
  });
  const fileName = `prompt-ia-orthophoto-${slugify(baseMap.name || "orthophoto")}.zip`;
  if (download) downloadBlob(blob, fileName);

  return {
    ok: true,
    fileName,
    sizeBytes: blob.size,
    photosCount: photos.length,
    missing,
    blob,
  };
}

// Models often wrap everything in one top folder: drop it so the paths match
// the ones written in orthophoto.json.
export function getCommonRoot(paths) {
  if (!paths.length) return "";
  const first = paths[0].split("/");
  if (first.length < 2) return "";
  const root = `${first[0]}/`;
  return paths.every((p) => p.startsWith(root)) ? root : "";
}

/**
 * Reads the zip returned by the AI chat: `orthophoto.json` + the mosaic +
 * the unit orthophotos.
 *
 * @returns {Promise<{ok: true, data, summary, filesByPath: Map<string, File>}
 *   | {ok: false, error: string}>}
 */
export async function readOrthophotoResultZip(file, { baseMapId }) {
  let zip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch (e) {
    return { ok: false, error: `Zip illisible : ${e?.message ?? String(e)}` };
  }
  const zipFiles = Object.values(zip.files).filter(
    (f) => !f.dir && !isIgnoredPath(f.name)
  );
  const root = getCommonRoot(zipFiles.map((f) => normalizeZipPath(f.name)));
  const byPath = new Map(
    zipFiles.map((f) => [normalizeZipPath(f.name).slice(root.length), f])
  );

  const jsons = [...byPath.keys()].filter((p) => /\.json$/i.test(p));
  const jsonPath =
    jsons.find((p) => p.toLowerCase().endsWith("orthophoto.json")) ??
    jsons.find((p) => p.toLowerCase() !== "contexte.json") ??
    null;
  if (!jsonPath)
    return {
      ok: false,
      error: "Le zip ne contient pas de fichier orthophoto.json.",
    };

  let json;
  try {
    json = JSON.parse(await byPath.get(jsonPath).async("string"));
  } catch (e) {
    return { ok: false, error: `${jsonPath} invalide : ${e.message}` };
  }

  const orthophotos = await getOrthophotosOfBaseMap(baseMapId);
  const parsed = parseOrthophotoPromptOutput(json, {
    imagePaths: [...byPath.keys()].filter((p) => getImageType(p)),
    knownNames: orthophotos.map((o) => o.name),
  });
  if (!parsed.ok) return parsed;

  const filesByPath = new Map();
  const paths = [
    parsed.data.file,
    ...parsed.data.photos.map((p) => p.orthoFile),
  ];
  for (const path of paths) {
    if (filesByPath.has(path)) continue;
    const blob = await byPath.get(path).async("blob");
    filesByPath.set(
      path,
      new File([blob], path.split("/").pop(), { type: getImageType(path) })
    );
  }
  return { ...parsed, filesByPath };
}

/**
 * Applies a parsed result (readOrthophotoResultZip) to the base map:
 * - the mosaic becomes its image: a new active version, the record frame
 *   (refWidth / refHeight) follows the mosaic, the blank page of an empty
 *   orthophoto base map is dropped;
 * - each returned photo gets its rectified image, station and corners.
 * Photos left out by the model stay pending.
 *
 * @returns {Promise<{updated: number, pending: string[], frameChanged: boolean,
 *   hadAnnotations: boolean, scaleKept: boolean, inactiveVersionIds: string[]}>}
 *   `inactiveVersionIds`: the former mosaics, kept as inactive versions —
 *   the caller hides them (baseMapEditor.hiddenVersionIds)
 */
export async function applyOrthophotoResultService({
  baseMapId,
  data,
  filesByPath,
}) {
  const record = await db.baseMaps.get(baseMapId);
  if (!record) throw new Error("Fond de plan introuvable.");
  const { projectId, listingId } = record;

  // 1. mosaic
  const mosaicFile = filesByPath.get(data.file);
  const versionId = nanoid();
  const mosaicFileName = `version_${versionId}_${baseMapId}.${getExtension(mosaicFile.name) || "png"}`;
  const url = URL.createObjectURL(mosaicFile);
  let imageSize;
  try {
    imageSize = await getImageSizeAsync(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  const image = {
    fileName: mosaicFileName,
    fileSize: mosaicFile.size,
    imageSize,
    thumbnail: await generateThumbnail(mosaicFile),
    isImage: true,
    fileType: "IMAGE",
    fileUpdatedAt: new Date().toISOString(),
  };
  const fileRecords = [
    {
      fileName: mosaicFileName,
      fileMime: mosaicFile.type || "image/png",
      srcFileName: mosaicFile.name,
      fileArrayBuffer: await mosaicFile.arrayBuffer(),
      fileType: "IMAGE",
      projectId,
      listingId,
      entityId: baseMapId,
      listingTable: "baseMaps",
    },
  ];

  const versions = (
    await db.baseMapVersions.where("baseMapId").equals(baseMapId).toArray()
  )
    .filter((v) => !v.deletedAt)
    .sort((a, b) =>
      (a.fractionalIndex || "").localeCompare(b.fractionalIndex || "")
    );
  const blankVersionIds = versions
    .filter((v) => testIsWhitePageImage(v.image))
    .map((v) => v.id);
  const keptVersions = versions.filter((v) => !blankVersionIds.includes(v.id));
  const lastIndex = versions.length
    ? versions[versions.length - 1].fractionalIndex || null
    : null;

  const wasBlank =
    testIsWhitePageImage(record.image) || keptVersions.length === 0;
  const frameChanged =
    !wasBlank &&
    (record.refWidth !== imageSize.width ||
      record.refHeight !== imageSize.height);
  const hadAnnotations =
    (await db.annotations
      .where("baseMapId")
      .equals(baseMapId)
      .filter((a) => !a.deletedAt)
      .count()) > 0;
  // The scale of the record only survives an unchanged frame.
  const meterByPx =
    data.meterByPx ?? (wasBlank || frameChanged ? null : record.meterByPx);

  // 2. unit orthophotos
  const rows = await getOrthophotosOfBaseMap(baseMapId);
  const rowByName = new Map(rows.map((r) => [r.name, r]));
  const rowUpdates = [];
  const obsoleteFileNames = [];
  for (const photo of data.photos) {
    const row = rowByName.get(photo.name);
    const orthoFile = filesByPath.get(photo.orthoFile);
    if (!row || !orthoFile) continue;
    const ortho = await buildOrthophotoImageAsync({
      file: orthoFile,
      role: "ortho",
      orthophotoId: row.id,
      projectId,
      listingId,
      baseMapId,
    });
    fileRecords.push(ortho.fileRecord);
    if (row.orthoImage?.fileName)
      obsoleteFileNames.push(row.orthoImage.fileName);
    rowUpdates.push({
      key: row.id,
      changes: {
        orthoImage: ortho.image,
        station: photo.station,
        corners: photo.corners,
      },
    });
  }

  await db.transaction(
    "rw",
    [db.files, db.baseMaps, db.baseMapVersions, db.orthophotos],
    async () => {
      await db.files.bulkPut(fileRecords);
      if (obsoleteFileNames.length > 0)
        await db.files.bulkDelete(obsoleteFileNames);
      if (blankVersionIds.length > 0)
        await db.baseMapVersions.bulkDelete(blankVersionIds);
      if (keptVersions.some((v) => v.isActive))
        await db.baseMapVersions.bulkUpdate(
          keptVersions
            .filter((v) => v.isActive)
            .map((v) => ({ key: v.id, changes: { isActive: false } }))
        );
      await db.baseMapVersions.put({
        id: versionId,
        baseMapId,
        projectId,
        listingId,
        label: `Orthomosaïque (${data.photos.length} photos)`,
        fractionalIndex: generateKeyBetween(lastIndex, null),
        isActive: true,
        image,
        transform: { x: 0, y: 0, rotation: 0, scale: 1 },
      });
      await db.baseMaps.update(baseMapId, {
        image,
        whitePage: null,
        isOrthophoto: true,
        refWidth: imageSize.width,
        refHeight: imageSize.height,
        meterByPx,
      });
      if (rowUpdates.length > 0) await db.orthophotos.bulkUpdate(rowUpdates);
    }
  );

  const updatedNames = new Set(data.photos.map((p) => p.name));
  return {
    updated: rowUpdates.length,
    pending: rows
      .filter((r) => !updatedNames.has(r.name) && isPendingOrthophoto(r))
      .map((r) => r.name),
    frameChanged,
    hadAnnotations,
    scaleKept: meterByPx != null,
    inactiveVersionIds: keptVersions.map((v) => v.id),
  };
}
