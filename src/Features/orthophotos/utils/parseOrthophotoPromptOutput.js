// Pure validation of `orthophoto.json`, the file an external AI chat returns
// (in a zip, next to the mosaic and the unit orthophotos) to UPDATE one
// orthomosaic base map from the photos of the Orthophotos tool — see
// docs/PROMPT_IA_ORTHOPHOTO_INSTRUCTIONS.md.
//
// Same `orthophoto` object as the project Prompt IA (`baseMaps[].orthophoto`,
// parsePromptIaProjectOutput), except that a photo is designated by the
// `name` it was given in the request: the original photos never come back.

import { parseOrthophoto } from "../../promptIaProject/utils/parsePromptIaProjectOutput.js";

const isObject = (v) =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

const normalizeName = (name) =>
  String(name ?? "")
    .trim()
    .toLowerCase();

/**
 * @param {Object} json - content of orthophoto.json
 * @param {{imagePaths: Iterable<string>, knownNames: string[]}} options
 *   `imagePaths` = images of the zip, `knownNames` = names of the photos of
 *   the base map (the ones sent in the request)
 * @returns {{ok: true, data: {file, meterByPx, photos, note, warnings}, summary}
 *   | {ok: false, error: string}}
 *   photos: [{name (a known name), orthoFile, station, corners}]
 */
export default function parseOrthophotoPromptOutput(
  json,
  { imagePaths = [], knownNames = [] } = {}
) {
  if (!isObject(json))
    return { ok: false, error: "Le JSON doit être un objet." };
  if (json.orthophoto == null)
    return { ok: false, error: "Clé `orthophoto` absente du JSON." };

  const warnings = [];
  const parsed = parseOrthophoto(json.orthophoto, {
    where: "",
    name: "l'orthomosaïque",
    imagePaths,
    warnings,
  });
  if (parsed.error)
    return { ok: false, error: parsed.error.replace(/^\./, "") };

  const knownByKey = new Map(knownNames.map((n) => [normalizeName(n), n]));
  const seen = new Set();
  const photos = [];
  for (const photo of parsed.value.photos) {
    const known = knownByKey.get(normalizeName(photo.name));
    if (!known) {
      warnings.push(
        `Orthophoto « ${photo.name} » ignorée : aucune photo de ce nom dans le fond de plan.`
      );
      continue;
    }
    if (seen.has(known)) {
      warnings.push(`Orthophoto « ${known} » en double : première gardée.`);
      continue;
    }
    seen.add(known);
    photos.push({
      name: known,
      orthoFile: photo.orthoFile,
      station: photo.station,
      corners: photo.corners,
    });
  }

  const missing = knownNames.filter((name) => !seen.has(name));
  return {
    ok: true,
    data: {
      file: parsed.value.file,
      meterByPx: parsed.value.meterByPx,
      photos,
      note: typeof json.note === "string" ? json.note.trim() : "",
      warnings,
    },
    summary: { photos: photos.length, missing },
  };
}
