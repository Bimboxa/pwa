// Pure validation of `reconstruction.json`, the file an external AI chat
// returns (in a zip, next to the GLB model) to fill one 3D reconstruction
// base map from its photos / video frames — see
// docs/PROMPT_IA_RECONSTRUCTION_3D_INSTRUCTIONS.md.

const isObject = (v) =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

const normalizePath = (path) =>
  String(path ?? "")
    .replace(/\\/g, "/")
    .replace(/^(\.\/|\/)+/, "")
    .trim();

// "F001", "f001.jpg", "donnees/images/F001.jpg" → "f001"
const normalizeName = (name) =>
  String(name ?? "")
    .trim()
    .split("/")
    .pop()
    .replace(/\.(jpe?g|png|webp)$/i, "")
    .toLowerCase();

function parseVector(value) {
  const array = Array.isArray(value)
    ? value
    : isObject(value)
      ? [value.x, value.y, value.z]
      : null;
  if (!array || array.length !== 3) return null;
  const vector = array.map(Number);
  return vector.every(Number.isFinite) ? vector : null;
}

function normalize([x, y, z]) {
  const length = Math.hypot(x, y, z);
  return length > 1e-9 ? [x / length, y / length, z / length] : null;
}

function parseFov(value) {
  const fov = Number(value);
  return value != null && Number.isFinite(fov) && fov > 1 && fov < 179
    ? fov
    : null;
}

// Exact path first, then case-insensitive, then the only GLB of the zip
// (models rename the file more often than they forget it).
function resolveModelPath(file, modelPaths) {
  const paths = [...modelPaths].map(normalizePath);
  const wanted = normalizePath(file);
  if (wanted) {
    const exact = paths.find((p) => p === wanted);
    if (exact) return exact;
    const lower = wanted.toLowerCase();
    const insensitive = paths.find((p) => p.toLowerCase() === lower);
    if (insensitive) return insensitive;
    const baseName = lower.split("/").pop();
    const sameName = paths.filter(
      (p) => p.toLowerCase().split("/").pop() === baseName
    );
    if (sameName.length === 1) return sameName[0];
  }
  return paths.length === 1 ? paths[0] : null;
}

/**
 * @param {Object} json - content of reconstruction.json
 * @param {{modelPaths: Iterable<string>, knownNames: string[]}} options
 *   `modelPaths` = .glb files of the zip, `knownNames` = names of the images
 *   of the base map (the ones sent in the request)
 * @returns {{ok: true, data: {file, scaleIsMetric, frames, note, warnings},
 *   summary: {frames: number, missing: string[]}} | {ok: false, error: string}}
 *   frames: [{name (a known name), position: [x, y, z], forward: [x, y, z]
 *   (unit), hfovDeg: number | null}] — glTF frame of the model
 */
export default function parseReconstructionPromptOutput(
  json,
  { modelPaths = [], knownNames = [] } = {}
) {
  if (!isObject(json))
    return { ok: false, error: "Le JSON doit être un objet." };
  const reconstruction = json.reconstruction;
  if (!isObject(reconstruction))
    return { ok: false, error: "Clé `reconstruction` absente du JSON." };

  const file = resolveModelPath(reconstruction.file, modelPaths);
  if (!file) {
    return {
      ok: false,
      error: reconstruction.file
        ? `Modèle « ${reconstruction.file} » introuvable dans le zip.`
        : "Le zip ne contient pas de modèle GLB.",
    };
  }

  const warnings = [];
  const rawFrames = Array.isArray(reconstruction.frames)
    ? reconstruction.frames
    : [];
  if (!Array.isArray(reconstruction.frames))
    warnings.push(
      "Aucune caméra dans le résultat (`frames` absent) : le modèle est chargé sans trajectoire."
    );
  const defaultFov = parseFov(reconstruction.hfovDeg);

  const knownByKey = new Map(knownNames.map((n) => [normalizeName(n), n]));
  const seen = new Set();
  const frames = [];
  let invalidCount = 0;
  let unknownCount = 0;
  for (const raw of rawFrames) {
    if (!isObject(raw)) {
      invalidCount += 1;
      continue;
    }
    const known = knownByKey.get(normalizeName(raw.name ?? raw.file));
    if (!known) {
      unknownCount += 1;
      continue;
    }
    if (seen.has(known)) {
      warnings.push(`Caméra « ${known} » en double : première gardée.`);
      continue;
    }
    const position = parseVector(raw.position);
    // `target` (a looked-at point) is accepted in place of `forward`
    const target = parseVector(raw.target);
    const direction =
      parseVector(raw.forward) ??
      (position && target
        ? [
            target[0] - position[0],
            target[1] - position[1],
            target[2] - position[2],
          ]
        : null);
    const forward = direction ? normalize(direction) : null;
    if (!position || !forward) {
      invalidCount += 1;
      continue;
    }
    seen.add(known);
    frames.push({
      name: known,
      position,
      forward,
      hfovDeg: parseFov(raw.hfovDeg) ?? defaultFov,
    });
  }
  if (invalidCount > 0)
    warnings.push(
      `${invalidCount} caméra(s) ignorée(s) : position ou direction invalide.`
    );
  if (unknownCount > 0)
    warnings.push(
      `${unknownCount} caméra(s) ignorée(s) : aucune image de ce nom dans le fond de plan.`
    );

  const missing = knownNames.filter((name) => !seen.has(name));
  return {
    ok: true,
    data: {
      file,
      scaleIsMetric: reconstruction.scaleIsMetric === true,
      frames,
      note: typeof json.note === "string" ? json.note.trim() : "",
      warnings,
    },
    summary: { frames: frames.length, missing },
  };
}
