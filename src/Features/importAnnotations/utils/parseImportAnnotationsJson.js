// Parses + validates the "inline JSON" pasted into the Import annotations panel.
//
// Expected shape (coordinates normalized to [0..1] vs the source image,
// origin top-left, x→right, y→down):
//
// {
//   "version": "1.0",
//   "image": { "width": <px>, "height": <px>, "widthMeters": <m, optional> },
//   "annotationTemplates": [
//     { "id": "tpl_x", "label": "...", "type": "POLYGON|POLYLINE|COTE",
//       "fillColor": "#RRGGBB", "fillOpacity": 0..1,
//       "strokeColor": "#RRGGBB", "strokeWidth": <n>, "strokeWidthUnit": "PX" }
//   ],
//   "annotations": [
//     { "id": "a1", "type": "POLYGON|POLYLINE|COTE",
//       "annotationTemplateId": "tpl_x", "closeLine": <bool>,
//       "points": [ { "x": 0..1, "y": 0..1, "type": "circle"? } ],
//       "cuts": [ { "points": [ ...>= 3 points ] } ]   // POLYGON holes, optional
//     },
//     { "id": "t1", "type": "FREE_TEXT", "annotationTemplateId": "tpl_txt",
//       "textContent": "...",
//       "labelPoint": { "x": 0..1, "y": 0..1 },        // CENTRE of the text box
//       "targetPoint": { "x": 0..1, "y": 0..1 } }      // connector end, optional
//   ]
// }
//
// Mirrored by the relay's zod schema (reperage-mcp/shared/inlineJson.ts): keep
// the two in sync.
//
// A second, "MESH" shape is also accepted: it adds a maillage to EXISTING
// annotations (referenced by id) instead of creating new ones. Cut lines
// mirror exactly what saveMeshService persists on the parent annotation:
//
// {
//   "version": "1.0",
//   "kind": "MESH",
//   "meshes": [
//     { "annotationId": "...", "mode": "POLYGON",
//       "meshLines": [ { "orientation": "VERTICAL|HORIZONTAL|FREE",
//                        "p1": { "x": 0..1, "y": 0..1 }, "p2": {...} } ] },
//     { "annotationId": "...", "mode": "POLYLINE",
//       "meshLinesBySegment": {
//         "<segIndex>": [ { "orientation": "...",
//                           "p1": { "u": 0..1, "z": <m> }, "p2": {...} } ] } }
//   ]
// }
//
// A third shape is the "annotations dump" copied by the debug button of the
// multi-selection toolbar — hydrated rows, points in PIXELS, no root
// `annotationTemplates` (each row embeds `annotationTemplateProps` instead):
//
// {
//   "imageSize": { "width": <px>, "height": <px> },
//   "meterByPx": <m/px>,
//   "annotations": [ { ...<db row>, "annotationTemplateProps": {...},
//                      "points": [ { "id": "...", "x": <px>, "y": <px> } ] } ]
// }
//
// It is normalized into the shape above by normalizeAnnotationsDumpJson and
// carries data.kind === "DUMP". See docs/annotations/IMPORT_ANNOTATIONS_DUMP.md.
//
// Returns { ok: true, data } or { ok: false, error } where error is a short
// human-readable French message for the panel. Mesh results carry
// data.kind === "MESH" so the panel can branch.

import { validateImageImport } from "./imageImport";
import normalizeAnnotationsDumpJson from "./normalizeAnnotationsDumpJson";

const SUPPORTED_TYPES = [
  "POLYLINE",
  "POLYGON",
  "COTE",
  "RULER",
  "STRIP",
  "FREE_TEXT",
  "IMAGE",
];

// Returns a French error message, or null when the point is a valid
// normalized {x, y}.
function validateNormalizedPoint(p) {
  if (typeof p?.x !== "number" || typeof p?.y !== "number") {
    return "Un point n'a pas de coordonnées x/y numériques.";
  }
  if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) {
    return "Les coordonnées des points doivent être normalisées dans [0..1].";
  }
  return null;
}

// FREE_TEXT has no `points`: a text and its two inline anchors.
function validateFreeText(ann) {
  if (typeof ann.textContent !== "string" || !ann.textContent.trim()) {
    return "Un FREE_TEXT doit avoir un `textContent` non vide.";
  }
  if (!ann.labelPoint && !ann.targetPoint) {
    return "Un FREE_TEXT doit avoir un `labelPoint` (centre de la boîte de texte).";
  }
  if (Array.isArray(ann.points) && ann.points.length > 0) {
    return "Un FREE_TEXT n'a pas de `points` (utiliser labelPoint / targetPoint).";
  }
  for (const key of ["labelPoint", "targetPoint"]) {
    if (ann[key] == null) continue;
    const err = validateNormalizedPoint(ann[key]);
    if (err) return err;
  }
  return null;
}

// POLYGON holes: closed rings of >= 3 normalized points.
function validateCuts(ann) {
  if (ann.cuts == null) return null;
  if (!Array.isArray(ann.cuts)) return "`cuts` doit être un tableau.";
  if (ann.cuts.length > 0 && ann.type !== "POLYGON") {
    return "Les `cuts` (ouvertures) ne sont supportés que sur un POLYGON.";
  }
  for (const cut of ann.cuts) {
    if (!Array.isArray(cut?.points) || cut.points.length < 3) {
      return "Chaque ouverture (`cuts`) doit avoir au moins 3 points.";
    }
    for (const p of cut.points) {
      const err = validateNormalizedPoint(p);
      if (err) return err;
    }
  }
  return null;
}
const MESH_ORIENTATIONS = ["VERTICAL", "HORIZONTAL", "FREE"];
const MESH_MODES = ["POLYGON", "POLYLINE"];

// Validate one cut line in the given space: "xy" (normalized [0..1] baseMap
// coords) or "uz" (u in [0..1] along the segment, z in meters ≥ 0).
function validateMeshLine(line, space) {
  if (!line || typeof line !== "object")
    return "Une ligne de coupe est invalide.";
  if (!MESH_ORIENTATIONS.includes(line.orientation)) {
    return `Orientation de ligne non supportée : ${line.orientation} (attendu ${MESH_ORIENTATIONS.join("/")}).`;
  }
  for (const key of ["p1", "p2"]) {
    const p = line[key];
    if (space === "xy") {
      if (typeof p?.x !== "number" || typeof p?.y !== "number") {
        return "Un point de ligne n'a pas de coordonnées x/y numériques.";
      }
      if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) {
        return "Les coordonnées des lignes doivent être normalisées dans [0..1].";
      }
    } else {
      if (typeof p?.u !== "number" || typeof p?.z !== "number") {
        return "Un point de ligne n'a pas de coordonnées u/z numériques.";
      }
      if (p.u < 0 || p.u > 1) return "La coordonnée `u` doit être dans [0..1].";
      if (p.z < 0) return "La coordonnée `z` doit être ≥ 0 (mètres).";
    }
  }
  const same =
    space === "xy"
      ? line.p1.x === line.p2.x && line.p1.y === line.p2.y
      : line.p1.u === line.p2.u && line.p1.z === line.p2.z;
  if (same) return "Une ligne de coupe a deux extrémités identiques.";
  return null;
}

function parseMeshJson(json) {
  const meshes = json.meshes;
  if (!Array.isArray(meshes) || meshes.length === 0) {
    return { ok: false, error: "`meshes` doit être un tableau non vide." };
  }
  const seenIds = new Set();
  for (const mesh of meshes) {
    if (!mesh?.annotationId || typeof mesh.annotationId !== "string") {
      return { ok: false, error: "Un mesh n'a pas d'`annotationId`." };
    }
    if (seenIds.has(mesh.annotationId)) {
      return {
        ok: false,
        error: `annotationId en double : ${mesh.annotationId}.`,
      };
    }
    seenIds.add(mesh.annotationId);
    if (!MESH_MODES.includes(mesh.mode)) {
      return {
        ok: false,
        error: `Mode de mesh non supporté : ${mesh.mode} (attendu ${MESH_MODES.join("/")}).`,
      };
    }
    // Empty line arrays / segments are tolerated (AIs often emit them for the
    // parts they chose not to mesh) — the import service skips them.
    if (mesh.mode === "POLYGON") {
      if (!Array.isArray(mesh.meshLines)) {
        return {
          ok: false,
          error: `\`meshLines\` doit être un tableau (${mesh.annotationId}).`,
        };
      }
      for (const line of mesh.meshLines) {
        const err = validateMeshLine(line, "xy");
        if (err) return { ok: false, error: err };
      }
    } else {
      const bySeg = mesh.meshLinesBySegment;
      if (!bySeg || typeof bySeg !== "object" || Array.isArray(bySeg)) {
        return {
          ok: false,
          error: `\`meshLinesBySegment\` doit être un objet (${mesh.annotationId}).`,
        };
      }
      for (const [segKey, lines] of Object.entries(bySeg)) {
        if (!/^\d+$/.test(segKey)) {
          return {
            ok: false,
            error: `Clé de segment invalide : "${segKey}" (index entier attendu).`,
          };
        }
        if (!Array.isArray(lines)) {
          return {
            ok: false,
            error: `Le segment ${segKey} doit avoir un tableau de lignes.`,
          };
        }
        for (const line of lines) {
          const err = validateMeshLine(line, "uz");
          if (err) return { ok: false, error: err };
        }
      }
    }
  }
  return { ok: true, data: { ...json, kind: "MESH" } };
}

// Validate the envelope of the "Copy annotations data" dump, then hand it to
// normalizeAnnotationsDumpJson. Unsupported types are skipped (and surfaced in
// data.skipped) rather than rejecting the whole paste — a dump of a mixed
// selection must stay importable.
function parseAnnotationsDumpJson(json) {
  const imageSize = json.imageSize;
  if (!imageSize || !(imageSize.width > 0) || !(imageSize.height > 0)) {
    return {
      ok: false,
      error:
        "Champ `imageSize` manquant ou invalide (width/height > 0 requis).",
    };
  }
  if (!Array.isArray(json.annotations) || json.annotations.length === 0) {
    return { ok: false, error: "`annotations` doit être un tableau non vide." };
  }

  const data = normalizeAnnotationsDumpJson(json);
  if (data.annotations.length === 0) {
    return {
      ok: false,
      error: `Aucune annotation importable (${data.skipped.length} ignorée(s)).`,
    };
  }
  return { ok: true, data };
}

export default function parseImportAnnotationsJson(text) {
  if (!text || !text.trim()) {
    return { ok: false, error: null }; // empty input → no error, just nothing
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `JSON invalide : ${e.message}` };
  }

  if (typeof json !== "object" || json === null) {
    return { ok: false, error: "Le JSON doit être un objet." };
  }

  // MESH shape → its own validation path
  if (json.kind === "MESH" || Array.isArray(json.meshes)) {
    return parseMeshJson(json);
  }

  // DUMP shape (debug "Copy annotations data") → validate + normalize to the shape below
  if (json.imageSize && Array.isArray(json.annotations)) {
    return parseAnnotationsDumpJson(json);
  }

  // image
  const image = json.image;
  if (!image || !(image.width > 0) || !(image.height > 0)) {
    return {
      ok: false,
      error: "Champ `image` manquant ou invalide (width/height > 0 requis).",
    };
  }

  // annotationTemplates
  const templates = json.annotationTemplates;
  if (!Array.isArray(templates) || templates.length === 0) {
    return {
      ok: false,
      error: "`annotationTemplates` doit être un tableau non vide.",
    };
  }
  for (const tpl of templates) {
    if (!tpl?.id)
      return { ok: false, error: "Un annotationTemplate n'a pas d'`id`." };
    if (!SUPPORTED_TYPES.includes(tpl.type)) {
      return {
        ok: false,
        error: `Type de template non supporté : ${tpl.type} (attendu ${SUPPORTED_TYPES.join("/")}).`,
      };
    }
  }
  const templateIds = new Set(templates.map((t) => t.id));

  // annotations — an empty array is accepted (templates-only payload: the
  // ChatGPT relay creates templates without placing anything).
  const annotations = json.annotations;
  if (!Array.isArray(annotations)) {
    return { ok: false, error: "`annotations` doit être un tableau." };
  }
  // Keep the dense PDF import budget aligned with the relay validator.
  const pointCount = annotations.reduce((sum, a) => {
    const groups = [
      a,
      ...[a?.cuts, a?.openings, a?.guideLines].flatMap((v) =>
        Array.isArray(v) ? v : []
      ),
    ];
    return (
      sum +
      groups.reduce(
        (n, group) =>
          n + (Array.isArray(group?.points) ? group.points.length : 0),
        0
      )
    );
  }, 0);
  if (annotations.length > 20000 || pointCount > 500000) {
    return {
      ok: false,
      error: "Import limité à 20 000 annotations et 500 000 points.",
    };
  }
  const imageError = validateImageImport(json);
  if (imageError) return { ok: false, error: imageError };
  for (const ann of annotations) {
    if (!SUPPORTED_TYPES.includes(ann?.type)) {
      return {
        ok: false,
        error: `Type d'annotation non supporté : ${ann?.type} (attendu ${SUPPORTED_TYPES.join("/")}).`,
      };
    }
    if (
      ann.annotationTemplateId &&
      !templateIds.has(ann.annotationTemplateId)
    ) {
      return {
        ok: false,
        error: `annotationTemplateId inconnu : ${ann.annotationTemplateId}.`,
      };
    }
    if (ann.type === "FREE_TEXT") {
      const err = validateFreeText(ann);
      if (err) return { ok: false, error: err };
      continue;
    }
    if (!Array.isArray(ann.points) || ann.points.length < 2) {
      return {
        ok: false,
        error: "Chaque annotation doit avoir au moins 2 points.",
      };
    }
    if (ann.type === "COTE" && ann.points.length !== 2) {
      return { ok: false, error: "Une COTE doit avoir exactement 2 points." };
    }
    for (const p of ann.points) {
      const err = validateNormalizedPoint(p);
      if (err) return { ok: false, error: err };
    }
    if (ann.openings !== undefined) {
      if (
        !["POLYLINE", "STRIP"].includes(ann.type) ||
        !Array.isArray(ann.openings) ||
        ann.openings.length > 500
      )
        return {
          ok: false,
          error: "Les openings nécessitent une POLYLINE ou une STRIP.",
        };
      for (const o of ann.openings) {
        const k = o.hostSegmentIndex ?? 0;
        const next =
          k +
          (ann.points[(k + 1) % ann.points.length]?.type === "circle" ? 2 : 1);
        if (
          !Number.isInteger(k) ||
          k < 0 ||
          !ann.points[k] ||
          ann.points[k].type === "circle" ||
          (!ann.closeLine && next >= ann.points.length) ||
          !Number.isFinite(o.width) ||
          o.width <= 0 ||
          !Number.isFinite(o.height) ||
          o.height <= 0 ||
          !Number.isFinite(o.hostDistanceM) ||
          o.hostDistanceM < 0 ||
          (o.offsetZ !== undefined && !Number.isFinite(o.offsetZ)) ||
          !Array.isArray(o.points) ||
          o.points.length < 2 ||
          o.points.length > 500
        )
          return {
            ok: false,
            error: "Ouverture invalide (segment hôte, dimensions ou points).",
          };
        for (const p of o.points) {
          const error = validateNormalizedPoint(p);
          if (error) return { ok: false, error };
        }
      }
    }
    if (ann.guideLines !== undefined) {
      if (!Array.isArray(ann.guideLines) || ann.guideLines.length > 500)
        return { ok: false, error: "guideLines invalides." };
      for (const g of ann.guideLines) {
        if (
          !Number.isFinite(g.slopePct) ||
          !Array.isArray(g.points) ||
          g.points.length < 2 ||
          g.points.length > 500
        )
          return { ok: false, error: "Ligne de pente invalide." };
        for (const p of g.points) {
          const error = validateNormalizedPoint(p);
          if (error) return { ok: false, error };
        }
      }
    }
    const cutsError = validateCuts(ann);
    if (cutsError) return { ok: false, error: cutsError };
  }

  return { ok: true, data: json };
}
