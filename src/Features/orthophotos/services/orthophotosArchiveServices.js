import JSZip from "jszip";

import downloadBlob from "Features/files/utils/downloadBlob";
import { slugify } from "Features/promptIa/services/buildPromptIaZip";
import { isIgnoredPath } from "Features/promptIaProject/utils/readDroppedEntries";
import {
  normalizeZipPath,
  resolveZipPath,
} from "Features/promptIaProject/utils/parsePromptIaProjectOutput";

import { isValidOrthophotoCorners } from "../utils/getOrthophotoPlacement";
import {
  addOrthophotosService,
  deleteOrthophotoService,
  getOrthophotosOfBaseMap,
} from "./orthophotoServices";
import {
  getCommonRoot,
  getImageType,
  readStoredFile,
} from "./orthophotoPromptServices";

// Archive of the unit orthophotos of ONE orthomosaic base map.
//
// The Krto zip only ships the RESULTING image of an orthomosaic (a regular
// base map version): the unit orthophotos — original photos, rectified
// images and their placement (station + 4 corners) — stay on the device
// (createKrtoZip). This archive is how they are saved and brought back,
// independently of the Krto:
//
//   orthophotos.json
//   unitaires/<nn>_<name>.<ext>   rectified images
//   sources/<nn>_<name>.<ext>     original photos (option, off by default)
//
// See docs/baseMaps/ORTHOPHOTOS.md.

export const ORTHOPHOTOS_ARCHIVE_KIND = "ORTHOPHOTOS_ARCHIVE";
const ARCHIVE_JSON = "orthophotos.json";
const ARCHIVE_VERSION = "1.0";

const isPoint = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);

/**
 * Builds (and downloads) `orthophotos-<base map name>.zip`.
 * `includeSources` (off by default): also archive the original photos, by
 * far the heaviest part.
 *
 * @returns {Promise<{ok: true, fileName, sizeBytes, count, missingFiles: number, blob}
 *   | {ok: false, error: string}>} `missingFiles`: images absent from this
 *   device (their row is archived without them)
 */
export async function buildOrthophotosArchiveZip({
  baseMap,
  includeSources = false,
  download = true,
}) {
  if (!baseMap?.id) return { ok: false, error: "Aucun fond de plan." };
  const orthophotos = await getOrthophotosOfBaseMap(baseMap.id);
  if (orthophotos.length === 0)
    return { ok: false, error: "Aucune orthophoto à sauvegarder." };

  const zip = new JSZip();
  let missingFiles = 0;
  const entries = [];
  for (const [index, orthophoto] of orthophotos.entries()) {
    const prefix = `${String(index + 1).padStart(3, "0")}_${slugify(orthophoto.name)}`;
    const addImage = async (image, folder) => {
      if (!image?.fileName) return null;
      const stored = await readStoredFile(image.fileName);
      if (!stored) {
        missingFiles += 1;
        return null;
      }
      const path = `${folder}/${prefix}.${stored.extension}`;
      zip.file(path, stored.blob, { compression: "STORE" });
      return path;
    };
    entries.push({
      name: orthophoto.name,
      station: orthophoto.station ?? null,
      corners: orthophoto.corners ?? null,
      isExcluded: Boolean(orthophoto.isExcluded),
      ortho: await addImage(orthophoto.orthoImage, "unitaires"),
      source: includeSources
        ? await addImage(orthophoto.sourceImage, "sources")
        : null,
    });
  }

  const size = baseMap.getImageSize?.() ?? null;
  zip.file(
    ARCHIVE_JSON,
    JSON.stringify(
      {
        app: "Krto",
        kind: ORTHOPHOTOS_ARCHIVE_KIND,
        version: ARCHIVE_VERSION,
        generatedAt: new Date().toISOString(),
        // false: the original photos were left out (lighter archive)
        includesSources: Boolean(includeSources),
        // the frame `station` / `corners` are normalized on
        baseMap: {
          id: baseMap.id,
          name: baseMap.name ?? null,
          width: size?.width ?? null,
          height: size?.height ?? null,
        },
        orthophotos: entries,
      },
      null,
      2
    )
  );

  const blob = await zip.generateAsync({ type: "blob", streamFiles: true });
  const fileName = `orthophotos-${slugify(baseMap.name || "orthophoto")}.zip`;
  if (download) downloadBlob(blob, fileName);
  return {
    ok: true,
    fileName,
    sizeBytes: blob.size,
    count: entries.length,
    missingFiles,
    blob,
  };
}

/**
 * Reads an archive built by buildOrthophotosArchiveZip.
 *
 * @returns {Promise<{ok: true, baseMap: Object|null, items: Array<{name, station, corners, orthoFile: File|null, sourceFile: File|null}>}
 *   | {ok: false, error: string}>}
 */
export async function readOrthophotosArchiveZip(file) {
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

  const jsonEntry = byPath.get(ARCHIVE_JSON);
  if (!jsonEntry)
    return {
      ok: false,
      error: `Ce zip n'est pas une sauvegarde d'orthophotos (${ARCHIVE_JSON} absent).`,
    };
  let json;
  try {
    json = JSON.parse(await jsonEntry.async("string"));
  } catch (e) {
    return { ok: false, error: `${ARCHIVE_JSON} invalide : ${e.message}` };
  }
  if (
    json?.kind !== ORTHOPHOTOS_ARCHIVE_KIND ||
    !Array.isArray(json.orthophotos)
  )
    return {
      ok: false,
      error: "Ce zip n'est pas une sauvegarde d'orthophotos.",
    };

  const imagePaths = [...byPath.keys()].filter((p) => getImageType(p));
  const readImage = async (path) => {
    const resolved = path ? resolveZipPath(path, imagePaths) : null;
    if (!resolved) return null;
    const blob = await byPath.get(resolved).async("blob");
    return new File([blob], resolved.split("/").pop(), {
      type: getImageType(resolved),
    });
  };

  const items = [];
  for (const [index, entry] of json.orthophotos.entries()) {
    const orthoFile = await readImage(entry?.ortho);
    const sourceFile = await readImage(entry?.source);
    if (!orthoFile && !sourceFile) continue;
    const placed =
      Boolean(orthoFile) && isValidOrthophotoCorners(entry.corners);
    items.push({
      name:
        (typeof entry.name === "string" && entry.name.trim()) ||
        `P${String(index + 1).padStart(2, "0")}`,
      station: placed && isPoint(entry.station) ? entry.station : null,
      corners: placed ? entry.corners.map(({ x, y }) => ({ x, y })) : null,
      orthoFile,
      sourceFile,
      isExcluded: entry.isExcluded === true,
    });
  }
  if (items.length === 0)
    return { ok: false, error: "La sauvegarde ne contient aucune image." };

  return { ok: true, baseMap: json.baseMap ?? null, items };
}

/**
 * Loads the orthophotos of an archive into a base map. An orthophoto of the
 * archive REPLACES the one of the same name (keeping its original photo when
 * the archive has none); the others are kept.
 *
 * @param {Object} params
 * @param {Object} params.baseMap - hydrated BaseMap (target)
 * @param {{baseMap, items}} params.archive - readOrthophotosArchiveZip result
 * @returns {Promise<{added: number, replaced: number, frameMismatch: boolean}>}
 *   `frameMismatch`: the archive was made on an image of another aspect
 *   ratio — the placements probably do not fit this base map
 */
export async function importOrthophotosArchiveService({ baseMap, archive }) {
  const existing = await getOrthophotosOfBaseMap(baseMap.id);
  const names = new Set(archive.items.map((item) => item.name));
  const toReplace = existing.filter((row) => names.has(row.name));
  // An archive made without the original photos must not cost the ones this
  // device still has: the replaced orthophoto hands its photo over.
  const items = archive.items.map((item) => ({ ...item }));
  for (const row of toReplace) {
    const item = items.find((i) => i.name === row.name && !i.sourceFile);
    if (!item || !row.sourceImage?.fileName) continue;
    const stored = await readStoredFile(row.sourceImage.fileName);
    if (stored)
      item.sourceFile = new File(
        [stored.blob],
        `${row.name}.${stored.extension}`,
        { type: stored.blob.type }
      );
  }
  for (const row of toReplace) await deleteOrthophotoService(row);

  const rows = await addOrthophotosService({
    baseMap: {
      id: baseMap.id,
      projectId: baseMap.projectId,
      listingId: baseMap.listingId,
    },
    items,
  });

  const size = baseMap.getImageSize?.();
  const from = archive.baseMap;
  const frameMismatch =
    Boolean(size?.width && size?.height && from?.width && from?.height) &&
    Math.abs(size.width / size.height - from.width / from.height) >
      0.01 * (size.width / size.height);

  return {
    added: Math.max(0, rows.length - toReplace.length),
    replaced: toReplace.length,
    frameMismatch,
  };
}
