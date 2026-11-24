import JSZip from "jszip";
import { nanoid } from "@reduxjs/toolkit";
import { generateKeyBetween } from "fractional-indexing";

import db from "App/db/db";

import downloadBlob from "Features/files/utils/downloadBlob";
import { slugify } from "Features/promptIa/services/buildPromptIaZip";
import { isIgnoredPath } from "Features/promptIaProject/utils/readDroppedEntries";
import { normalizeZipPath } from "Features/promptIaProject/utils/parsePromptIaProjectOutput";
import { testIsWhitePageImage } from "Features/baseMaps/utils/createWhitePageImage";
import { prepareVersionImageReplacement } from "Features/baseMaps/services/replaceVersionImageService";
import {
  getCommonRoot,
  readStoredFile,
} from "Features/orthophotos/services/orthophotoPromptServices";
import parseScene3dGlb, {
  disposeScene3dGlbModel,
} from "Features/scene3d/js/parseScene3dGlb";
import bakeScene3dGlbImageService from "Features/scene3d/services/bakeScene3dGlbImageService";
import { seedScene3dGlb } from "Features/scene3d/services/scene3dGlbCache";
import {
  deleteScene3dGlbFileService,
  getScene3dGlbFileName,
  saveScene3dGlbFileService,
} from "Features/scene3d/services/scene3dGlbFileService";
import { SCENE_3D_TOP_VIEW_SIZES } from "Features/scene3d/constants/scene3dConstants";
import {
  getScene3dBboxPolygon,
  getScene3dGlbBaseMapDescriptor,
} from "Features/scene3d/utils/getScene3dBaseMapDescriptor";

import instructionsBody from "../docs/PROMPT_IA_RECONSTRUCTION_3D_INSTRUCTIONS.md?raw";
import parseReconstructionPromptOutput from "../utils/parseReconstructionPromptOutput";
import { RECONSTRUCTION_MEDIA_TYPES } from "../constants/reconstruction3dTool";
import { getReconstructionFramesOfBaseMap } from "./reconstructionFramesServices";

// Prompt IA round trip of the Reconstruction 3D tool:
//   1. the dropped photos / the frames sampled from the dropped video are
//      db.reconstructionFrames rows (reconstructionFramesServices);
//   2. buildReconstructionPromptZip: INSTRUCTIONS.md + contexte.json + the
//      images, for an external AI chat;
//   3. readReconstructionResultZip + applyReconstructionResultService: the
//      returned zip (reconstruction.json + the GLB model) becomes the model
//      of the base map — top view as its image, GLB for the 3D editor, like
//      a « Scène 3D » GLB base map — and each image gets its camera.
// See docs/baseMaps/RECONSTRUCTION_3D.md.

const isGlbPath = (path) => /\.glb$/i.test(path);

function buildInstructionsMarkdown(context) {
  const { baseMap, media, frames } = context;
  const isVideo = media.type === RECONSTRUCTION_MEDIA_TYPES.VIDEO;
  const lines = [
    `# Reconstruction 3D — ${baseMap.name}`,
    "",
    "> Suis ces instructions jusqu'au bout, puis renvoie le zip demandé dans",
    "> la section « Forme de la réponse ».",
    "",
    "## Demande",
    "",
    `**Fond de plan** : ${baseMap.name}`,
    "",
    isVideo
      ? `Reconstruis en 3D la scène filmée : ${frames.length} images ont été extraites d'une vidéo de ${media.durationS.toFixed(1)} s (une image toutes les ${media.sampleIntervalS.toFixed(2)} s, dans l'ordre du film). Renvoie le modèle et la caméra de chaque image.`
      : `Reconstruis en 3D la scène photographiée à partir des ${frames.length} photos. Renvoie le modèle et la caméra de chaque photo.`,
    "",
    "**Fichiers**",
    "",
    "- `contexte.json` — données de la demande (à lire en premier)",
    `- \`donnees/images/\` — ${frames.length} image(s), de \`${frames[0].name}\` à \`${frames[frames.length - 1].name}\``,
    "",
    "---",
    "",
    instructionsBody.trim(),
    "",
  ];
  return lines.join("\n");
}

/**
 * Builds (and downloads) `prompt-ia-reconstruction-3d-<name>.zip`:
 * INSTRUCTIONS.md, contexte.json and the images under `donnees/images/`.
 *
 * @param {Object} params
 * @param {Object} params.baseMap - hydrated BaseMap (or raw record)
 * @param {boolean} [params.download=true]
 * @returns {Promise<{ok: true, fileName, sizeBytes, framesCount, missing: string[], blob}
 *   | {ok: false, error: string}>} `missing`: images whose file is not on
 *   this device (left out of the zip)
 */
export async function buildReconstructionPromptZip({
  baseMap,
  download = true,
}) {
  if (!baseMap?.id) return { ok: false, error: "Aucun fond de plan." };
  const record = await db.baseMaps.get(baseMap.id);
  const rows = await getReconstructionFramesOfBaseMap(baseMap.id);

  const zip = new JSZip();
  const frames = [];
  const missing = [];
  for (const row of rows) {
    const stored = await readStoredFile(row.image?.fileName);
    if (!stored) {
      missing.push(row.name);
      continue;
    }
    const file = `donnees/images/${row.name}.${stored.extension}`;
    // already compressed images
    zip.file(file, stored.blob, { compression: "STORE" });
    frames.push({
      name: row.name,
      file,
      width: row.image.imageSize?.width ?? null,
      height: row.image.imageSize?.height ?? null,
      ...(Number.isFinite(row.timeS) && {
        timeS: Math.round(row.timeS * 1000) / 1000,
      }),
    });
  }
  if (frames.length === 0)
    return { ok: false, error: "Aucune image à envoyer." };

  const video = record?.reconstruction3d?.video ?? null;
  const isVideo =
    record?.reconstruction3d?.mediaType === RECONSTRUCTION_MEDIA_TYPES.VIDEO &&
    frames.some((f) => f.timeS != null);
  const times = frames.map((f) => f.timeS).filter((t) => t != null);
  const context = {
    kind: "RECONSTRUCTION_3D",
    baseMap: { name: baseMap.name || "Reconstruction 3D" },
    media: isVideo
      ? {
          type: RECONSTRUCTION_MEDIA_TYPES.VIDEO,
          durationS: video?.durationS ?? Math.max(...times),
          sampleIntervalS:
            record.reconstruction3d.sampleIntervalS ??
            (times.length > 1 ? times[1] - times[0] : 0),
          sourceWidth: video?.width ?? null,
          sourceHeight: video?.height ?? null,
        }
      : { type: RECONSTRUCTION_MEDIA_TYPES.PHOTOS },
    frames,
    output: {
      zipEntries: ["reconstruction.json", "reconstruction/modele.glb"],
      rootKeys: ["version", "reconstruction", "note"],
      frameNames: frames.map((f) => f.name),
      model:
        "GLB binary, glTF 2.0, embedded textures, no Draco / Meshopt / KTX2",
      coordinates:
        "glTF frame of the model: right-handed, Y up (gravity), metres",
      camera:
        "position = optical centre, forward = unit viewing direction, hfovDeg = horizontal field of view",
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
  const fileName = `prompt-ia-reconstruction-3d-${slugify(baseMap.name || "reconstruction-3d")}.zip`;
  if (download) downloadBlob(blob, fileName);

  return {
    ok: true,
    fileName,
    sizeBytes: blob.size,
    framesCount: frames.length,
    missing,
    blob,
  };
}

/**
 * Reads the zip returned by the AI chat: `reconstruction.json` + the GLB.
 *
 * @returns {Promise<{ok: true, data, summary, modelFile: File}
 *   | {ok: false, error: string}>}
 */
export async function readReconstructionResultZip(file, { baseMapId }) {
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
    jsons.find((p) => p.toLowerCase().endsWith("reconstruction.json")) ??
    jsons.find((p) => p.toLowerCase() !== "contexte.json") ??
    null;
  if (!jsonPath)
    return {
      ok: false,
      error: "Le zip ne contient pas de fichier reconstruction.json.",
    };

  let json;
  try {
    json = JSON.parse(await byPath.get(jsonPath).async("string"));
  } catch (e) {
    return { ok: false, error: `${jsonPath} invalide : ${e.message}` };
  }

  const frames = await getReconstructionFramesOfBaseMap(baseMapId);
  const parsed = parseReconstructionPromptOutput(json, {
    modelPaths: [...byPath.keys()].filter(isGlbPath),
    knownNames: frames.map((f) => f.name),
  });
  if (!parsed.ok) return parsed;

  const blob = await byPath.get(parsed.data.file).async("blob");
  const modelFile = new File([blob], parsed.data.file.split("/").pop(), {
    type: "model/gltf-binary",
  });
  return { ...parsed, modelFile };
}

const GLB_ERROR_MESSAGES = {
  SCENE_GLB_COMPRESSED:
    "Le GLB est compressé (Draco / Meshopt / KTX2) : demandez à l'IA un GLB sans compression.",
  SCENE_GLB_INVALID: "Le fichier GLB est illisible.",
  SCENE_GLB_EMPTY: "Le GLB ne contient aucun maillage.",
};

/**
 * Applies a parsed result (readReconstructionResultZip) to the base map:
 * - the GLB becomes its 3D model (baseMap.scene3d, format "GLB" — the 3D
 *   editor shows it like a « Scène 3D » base map) and its top view, baked
 *   here, becomes its image (the active version takes it; the reference
 *   frame follows);
 * - each returned image gets its camera (pose, glTF frame of the model); the
 *   images left out by the model lose theirs — the cameras of a former
 *   model mean nothing in the new one.
 * `scene3d.relativeToBaseMap`: the model follows the scale of the base map,
 * so that calibrating the plan (scale tool) resizes the model and its camera
 * path. Without a metric scale from the AI, `meterByPx` stays null (no
 * measurement until the plan is calibrated).
 *
 * @returns {Promise<{posed: number, unposed: string[], frameChanged: boolean,
 *   hadAnnotations: boolean, scaleIsMetric: boolean}>}
 */
export async function applyReconstructionResultService({
  baseMapId,
  data,
  modelFile,
}) {
  const record = await db.baseMaps.get(baseMapId);
  if (!record || record.deletedAt) throw new Error("Fond de plan introuvable.");
  const { projectId, listingId } = record;

  let model;
  try {
    model = await parseScene3dGlb(await modelFile.arrayBuffer());
  } catch (error) {
    throw new Error(GLB_ERROR_MESSAGES[error?.code] ?? error?.message);
  }

  const sceneId = nanoid();
  const glbFileName = getScene3dGlbFileName(sceneId);
  const previousGlbFileName = record.scene3d?.glbFileName ?? null;
  try {
    // 1. top view of the whole model = image of the base map
    const polygon = getScene3dBboxPolygon(model.bbox);
    const scene3d = getScene3dGlbBaseMapDescriptor({
      descriptor: {
        ...model,
        sceneId,
        srcFileName: modelFile.name,
        fileBytes: modelFile.size,
      },
      glbFileName,
      polygon,
      rotationDeg: 0,
    });
    scene3d.relativeToBaseMap = true;
    const baked = await bakeScene3dGlbImageService({
      model,
      zone: { ...scene3d.zone, rotationDeg: 0 },
      maxPx: SCENE_3D_TOP_VIEW_SIZES.STANDARD.maxPx,
    });
    const extension = baked.fileMime === "image/webp" ? "webp" : "png";
    const imageFile = new File(
      [baked.blob],
      `${slugify(record.name || "reconstruction-3d")}.${extension}`,
      { type: baked.fileMime }
    );
    const imageSize = { width: baked.width, height: baked.height };
    const { fileRecord, image } = await prepareVersionImageReplacement({
      baseMapId,
      record,
      file: imageFile,
      imageSize,
    });

    // 2. version taking the image: the active one (the blank page of an
    // empty reconstruction base map included)
    const versions = (
      await db.baseMapVersions.where("baseMapId").equals(baseMapId).toArray()
    )
      .filter((v) => !v.deletedAt)
      .sort((a, b) =>
        (a.fractionalIndex || "").localeCompare(b.fractionalIndex || "")
      );
    const activeVersion =
      versions.find((v) => v.isActive) ?? versions.at(-1) ?? null;
    const obsoleteFileNames = [];
    if (
      activeVersion?.image?.fileName &&
      !testIsWhitePageImage(activeVersion.image)
    )
      obsoleteFileNames.push(activeVersion.image.fileName);

    const wasBlank = testIsWhitePageImage(record.image) || !activeVersion;
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

    // 3. cameras
    const rows = await getReconstructionFramesOfBaseMap(baseMapId);
    const poseByName = new Map(data.frames.map((f) => [f.name, f]));
    const rowUpdates = rows.map((row) => {
      const frame = poseByName.get(row.name);
      return {
        key: row.id,
        changes: {
          pose: frame
            ? {
                position: frame.position,
                forward: frame.forward,
                ...(frame.hfovDeg != null && { hfovDeg: frame.hfovDeg }),
              }
            : null,
        },
      };
    });

    await db.transaction(
      "rw",
      [db.files, db.baseMaps, db.baseMapVersions, db.reconstructionFrames],
      async () => {
        const current = await db.baseMaps.get(baseMapId);
        if (!current || current.deletedAt)
          throw new Error("Fond de plan introuvable.");
        await saveScene3dGlbFileService({
          fileName: glbFileName,
          file: modelFile,
          projectId,
        });
        await db.files.put(fileRecord);
        if (obsoleteFileNames.length > 0)
          await db.files.bulkDelete(obsoleteFileNames);
        const transform = { x: 0, y: 0, rotation: 0, scale: 1 };
        if (activeVersion) {
          await db.baseMapVersions.update(activeVersion.id, {
            image,
            isActive: true,
            transform,
          });
        } else {
          await db.baseMapVersions.put({
            id: nanoid(),
            baseMapId,
            projectId,
            listingId,
            label: "Image d'origine",
            fractionalIndex: generateKeyBetween(null, null),
            isActive: true,
            image,
            transform,
          });
        }
        await db.baseMaps.update(baseMapId, {
          image,
          whitePage: null,
          isReconstruction3d: true,
          refWidth: imageSize.width,
          refHeight: imageSize.height,
          meterByPx: data.scaleIsMetric ? 1 / baked.pxPerMeter : null,
          scene3d,
        });
        if (rowUpdates.length > 0)
          await db.reconstructionFrames.bulkUpdate(rowUpdates);
      }
    );

    // the base map owns the model now: no second parse in the 3D editor
    seedScene3dGlb(glbFileName, model);
    if (previousGlbFileName && previousGlbFileName !== glbFileName)
      await deleteScene3dGlbFileService(previousGlbFileName).catch(() => {});

    return {
      posed: data.frames.length,
      unposed: rows.filter((r) => !poseByName.has(r.name)).map((r) => r.name),
      frameChanged,
      hadAnnotations,
      scaleIsMetric: Boolean(data.scaleIsMetric),
    };
  } catch (error) {
    disposeScene3dGlbModel(model);
    throw error;
  }
}
