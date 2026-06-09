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
//       "points": [ { "x": 0..1, "y": 0..1, "type": "circle"? } ] }
//   ]
// }
//
// Returns { ok: true, data } or { ok: false, error } where error is a short
// human-readable French message for the panel.

const SUPPORTED_TYPES = ["POLYLINE", "POLYGON", "COTE"];

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
    return { ok: false, error: "`annotationTemplates` doit être un tableau non vide." };
  }
  for (const tpl of templates) {
    if (!tpl?.id) return { ok: false, error: "Un annotationTemplate n'a pas d'`id`." };
    if (!SUPPORTED_TYPES.includes(tpl.type)) {
      return {
        ok: false,
        error: `Type de template non supporté : ${tpl.type} (attendu ${SUPPORTED_TYPES.join("/")}).`,
      };
    }
  }
  const templateIds = new Set(templates.map((t) => t.id));

  // annotations
  const annotations = json.annotations;
  if (!Array.isArray(annotations) || annotations.length === 0) {
    return { ok: false, error: "`annotations` doit être un tableau non vide." };
  }
  for (const ann of annotations) {
    if (!SUPPORTED_TYPES.includes(ann?.type)) {
      return {
        ok: false,
        error: `Type d'annotation non supporté : ${ann?.type} (attendu ${SUPPORTED_TYPES.join("/")}).`,
      };
    }
    if (ann.annotationTemplateId && !templateIds.has(ann.annotationTemplateId)) {
      return {
        ok: false,
        error: `annotationTemplateId inconnu : ${ann.annotationTemplateId}.`,
      };
    }
    if (!Array.isArray(ann.points) || ann.points.length < 2) {
      return { ok: false, error: "Chaque annotation doit avoir au moins 2 points." };
    }
    if (ann.type === "COTE" && ann.points.length !== 2) {
      return { ok: false, error: "Une COTE doit avoir exactement 2 points." };
    }
    for (const p of ann.points) {
      if (typeof p?.x !== "number" || typeof p?.y !== "number") {
        return { ok: false, error: "Un point n'a pas de coordonnées x/y numériques." };
      }
      if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) {
        return {
          ok: false,
          error: "Les coordonnées des points doivent être normalisées dans [0..1].",
        };
      }
    }
  }

  return { ok: true, data: json };
}
