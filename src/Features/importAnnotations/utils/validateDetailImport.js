// Validation of the "carnet de détails" part of the inline import JSON:
// DETAIL annotations (a bubble with an arrow) and the root `baseMaps` block
// (detail baseMaps to create from an attached PDF). Pure module (no imports)
// so it runs under `node --test`. Messages are French: they are shown in the
// panel and sent back to the model.
//
// Mirrored by the relay's zod schema (reperage-mcp/shared/inlineJson.ts).

export const MAX_IMPORT_BASE_MAPS = 200;
const ROTATIONS = [0, 90, 180, 270];

function isRatio(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
  );
}

// DETAIL: a single `point` (tip of the arrow), no `points`.
export function validateDetailAnnotation(ann) {
  const p = ann?.point;
  if (typeof p?.x !== "number" || typeof p?.y !== "number") {
    return "Un DETAIL doit avoir un `point` (pointe de la flèche) avec x/y numériques.";
  }
  if (!isRatio(p.x) || !isRatio(p.y)) {
    return "Les coordonnées des points doivent être normalisées dans [0..1].";
  }
  if (Array.isArray(ann.points) && ann.points.length > 0) {
    return "Un DETAIL n'a pas de `points` (utiliser `point`).";
  }
  if (
    ann.arrowAngle !== undefined &&
    (typeof ann.arrowAngle !== "number" || !Number.isFinite(ann.arrowAngle))
  ) {
    return "L'`arrowAngle` d'un DETAIL doit être un nombre (degrés).";
  }
  if (ann.detailBaseMapId !== undefined && ann.detailBaseMapId !== null) {
    if (
      typeof ann.detailBaseMapId !== "string" ||
      !ann.detailBaseMapId.trim() ||
      ann.detailBaseMapId.length > 200
    ) {
      return "Le `detailBaseMapId` d'un DETAIL doit être un identifiant non vide.";
    }
  }
  return null;
}

// Root `baseMaps`: optional array of detail baseMaps to create.
export function validateImportBaseMaps(baseMaps) {
  if (baseMaps === undefined || baseMaps === null) return null;
  if (!Array.isArray(baseMaps)) return "`baseMaps` doit être un tableau.";
  if (baseMaps.length > MAX_IMPORT_BASE_MAPS) {
    return `Import limité à ${MAX_IMPORT_BASE_MAPS} fonds de détail.`;
  }

  const ids = new Set();
  for (const bm of baseMaps) {
    if (typeof bm?.id !== "string" || !bm.id.trim()) {
      return "Un élément de `baseMaps` n'a pas d'`id`.";
    }
    if (ids.has(bm.id)) return `\`baseMaps\` : id en double « ${bm.id} ».`;
    ids.add(bm.id);

    if (bm.kind !== "detail") {
      return `\`baseMaps\` « ${bm.id} » : \`kind\` doit valoir "detail".`;
    }
    if (
      bm.name !== undefined &&
      bm.name !== null &&
      (typeof bm.name !== "string" || bm.name.length > 300)
    ) {
      return `\`baseMaps\` « ${bm.id} » : \`name\` invalide (300 caractères au plus).`;
    }
    if (
      bm.detailRef !== undefined &&
      bm.detailRef !== null &&
      (typeof bm.detailRef !== "string" || bm.detailRef.length > 20)
    ) {
      return `\`baseMaps\` « ${bm.id} » : \`detailRef\` invalide (20 caractères au plus).`;
    }

    const source = bm.source;
    if (!source || typeof source !== "object") {
      return `\`baseMaps\` « ${bm.id} » : \`source\` manquant.`;
    }
    if (typeof source.attachmentId !== "string" || !source.attachmentId.trim()) {
      return `\`baseMaps\` « ${bm.id} » : \`source.attachmentId\` manquant.`;
    }
    if (!Number.isInteger(source.pageNumber) || source.pageNumber < 1) {
      return `\`baseMaps\` « ${bm.id} » : \`source.pageNumber\` doit être un entier ≥ 1.`;
    }
    if (
      source.rotation !== undefined &&
      source.rotation !== null &&
      !ROTATIONS.includes(source.rotation)
    ) {
      return `\`baseMaps\` « ${bm.id} » : \`source.rotation\` doit valoir 0, 90, 180 ou 270.`;
    }
    const bbox = source.bboxInRatio;
    if (bbox !== undefined && bbox !== null) {
      const valid =
        typeof bbox === "object" &&
        isRatio(bbox.x1) &&
        isRatio(bbox.y1) &&
        isRatio(bbox.x2) &&
        isRatio(bbox.y2) &&
        bbox.x1 < bbox.x2 &&
        bbox.y1 < bbox.y2;
      if (!valid) {
        return `\`baseMaps\` « ${bm.id} » : \`source.bboxInRatio\` invalide (x1 < x2, y1 < y2, dans [0..1]).`;
      }
    }
  }
  return null;
}
