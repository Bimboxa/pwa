// Pure validation / normalization of `projet.json`, the file an external AI
// chat returns (in a zip, next to the PDFs) to create a whole project:
// base maps, scopes, annotation listings, templates and annotations.

import { COORDINATE_SPACES } from "../../promptIa/utils/parsePromptIaOutput.js";

export const BASE_MAP_LISTING_KINDS = ["PLAN", "ELEVATION"];
export const PROJECT_ANNOTATION_TYPES = [
  "POLYLINE",
  "POLYGON",
  "STRIP",
  "COTE",
  "FREE_TEXT",
];
export const MAX_BASE_MAPS = 200;
export const MAX_SCOPES = 50;
export const MAX_ANNOTATIONS = 20000;

const ROTATIONS = [0, 90, 180, 270];

const fail = (error) => ({ ok: false, error });

const isObject = (v) =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

const cleanString = (v) => (typeof v === "string" ? v.trim() : "");

export function normalizeZipPath(path) {
  return String(path ?? "")
    .replace(/\\/g, "/")
    .replace(/^(\.\/|\/)+/, "")
    .trim();
}

// Resolves `source.file` against the PDFs of the zip: exact path first, then
// case-insensitive, then the bare file name when it is unambiguous (models
// often drop the `pdfs/` folder).
export function resolvePdfPath(file, pdfPaths) {
  const wanted = normalizeZipPath(file);
  if (!wanted) return null;
  const paths = [...(pdfPaths ?? [])];
  if (paths.includes(wanted)) return wanted;
  const lower = wanted.toLowerCase();
  const sameCase = paths.filter((p) => p.toLowerCase() === lower);
  if (sameCase.length === 1) return sameCase[0];
  const baseName = lower.split("/").pop();
  const sameName = paths.filter(
    (p) => p.toLowerCase().split("/").pop() === baseName
  );
  return sameName.length === 1 ? sameName[0] : null;
}

function parseBbox(bbox) {
  if (bbox == null) return { value: null };
  const { x1, y1, x2, y2 } = bbox;
  const ok =
    [x1, y1, x2, y2].every((v) => Number.isFinite(v) && v >= 0 && v <= 1) &&
    x1 < x2 &&
    y1 < y2;
  return ok ? { value: { x1, y1, x2, y2 } } : { error: true };
}

function parseBaseMaps(rawBaseMaps, { pdfPaths, newId }) {
  if (rawBaseMaps != null && !Array.isArray(rawBaseMaps))
    return fail("`baseMaps` doit être un tableau.");
  const list = rawBaseMaps ?? [];
  if (list.length > MAX_BASE_MAPS)
    return fail(`Import limité à ${MAX_BASE_MAPS} fonds de plan.`);

  const idMap = new Map();
  const baseMaps = [];
  for (const [index, bm] of list.entries()) {
    const where = `baseMaps[${index}]`;
    if (!isObject(bm)) return fail(`${where} doit être un objet.`);
    const authorId = cleanString(bm.id);
    if (!authorId) return fail(`${where} n'a pas d'\`id\`.`);
    if (idMap.has(authorId))
      return fail(`Identifiant de fond de plan en double : ${authorId}.`);

    const listing = bm.listing ?? "PLAN";
    if (!BASE_MAP_LISTING_KINDS.includes(listing))
      return fail(
        `${where}.listing inconnu : ${listing} (attendu ${BASE_MAP_LISTING_KINDS.join(" ou ")}).`
      );

    const source = bm.source;
    if (!isObject(source)) return fail(`${where}.source manquant.`);
    const file = resolvePdfPath(source.file, pdfPaths);
    if (!file)
      return fail(
        `${where}.source.file introuvable dans le zip : ${source.file ?? "(vide)"}.`
      );
    const pageNumber = source.pageNumber ?? 1;
    if (!Number.isInteger(pageNumber) || pageNumber < 1)
      return fail(`${where}.source.pageNumber doit être un entier ≥ 1.`);
    const rotation = source.rotation ?? null;
    if (rotation !== null && !ROTATIONS.includes(rotation))
      return fail(`${where}.source.rotation doit valoir 0, 90, 180 ou 270.`);
    const bbox = parseBbox(source.bboxInRatio);
    if (bbox.error)
      return fail(
        `${where}.source.bboxInRatio invalide (x1 < x2, y1 < y2, valeurs dans [0, 1]).`
      );

    const scale = bm.blueprintScale ?? null;
    if (scale !== null && !(Number.isFinite(scale) && scale > 0))
      return fail(
        `${where}.blueprintScale doit être un nombre > 0 (100 pour 1/100).`
      );

    const id = newId();
    idMap.set(authorId, id);
    baseMaps.push({
      id,
      name: cleanString(bm.name) || `Fond de plan ${index + 1}`,
      listing,
      source: { file, pageNumber, rotation, bboxInRatio: bbox.value },
      blueprintScale: scale,
    });
  }
  return { ok: true, baseMaps, idMap };
}

function parseListing(listing, where, { baseMapIdMap, newId }) {
  if (!isObject(listing)) return fail(`${where} doit être un objet.`);
  const name = cleanString(listing.name);
  if (!name) return fail(`${where} n'a pas de \`name\`.`);

  const rawTemplates = listing.annotationTemplates ?? [];
  if (!Array.isArray(rawTemplates))
    return fail(`${where}.annotationTemplates doit être un tableau.`);
  // Template ids are local to their listing: two listings may both use
  // "tpl_mur". Every one is reminted so no author id reaches the database.
  const templateIdMap = new Map();
  const annotationTemplates = [];
  for (const [index, tpl] of rawTemplates.entries()) {
    const tplWhere = `${where}.annotationTemplates[${index}]`;
    if (!isObject(tpl)) return fail(`${tplWhere} doit être un objet.`);
    const authorId = cleanString(tpl.id);
    if (!authorId) return fail(`${tplWhere} n'a pas d'\`id\`.`);
    if (templateIdMap.has(authorId))
      return fail(
        `Identifiant de modèle en double dans ${where} : ${authorId}.`
      );
    if (!PROJECT_ANNOTATION_TYPES.includes(tpl.type))
      return fail(
        `${tplWhere}.type non pris en charge : ${tpl.type} (attendu ${PROJECT_ANNOTATION_TYPES.join("/")}).`
      );
    const id = newId();
    templateIdMap.set(authorId, id);
    annotationTemplates.push({ ...tpl, id });
  }

  const rawAnnotations = listing.annotations ?? [];
  if (!Array.isArray(rawAnnotations))
    return fail(`${where}.annotations doit être un tableau.`);
  const annotations = [];
  for (const [index, ann] of rawAnnotations.entries()) {
    const annWhere = `${where}.annotations[${index}]`;
    if (!isObject(ann)) return fail(`${annWhere} doit être un objet.`);
    if (!PROJECT_ANNOTATION_TYPES.includes(ann.type))
      return fail(
        `${annWhere}.type non pris en charge : ${ann.type} (attendu ${PROJECT_ANNOTATION_TYPES.join("/")}).`
      );
    if (!baseMapIdMap.has(ann.baseMapId))
      return fail(
        `${annWhere}.baseMapId inconnu : ${ann.baseMapId ?? "(vide)"}.`
      );
    if (!templateIdMap.has(ann.annotationTemplateId))
      return fail(
        `${annWhere}.annotationTemplateId inconnu : ${ann.annotationTemplateId ?? "(vide)"}.`
      );
    annotations.push({
      ...ann,
      id: newId(),
      baseMapId: baseMapIdMap.get(ann.baseMapId),
      annotationTemplateId: templateIdMap.get(ann.annotationTemplateId),
    });
  }

  return {
    ok: true,
    listing: { id: newId(), name, annotationTemplates, annotations },
  };
}

function parseScopes(rawScopes, options) {
  if (rawScopes != null && !Array.isArray(rawScopes))
    return fail("`scopes` doit être un tableau.");
  const list = rawScopes ?? [];
  if (list.length > MAX_SCOPES)
    return fail(`Import limité à ${MAX_SCOPES} scopes.`);

  const seen = new Set();
  const scopes = [];
  for (const [index, scope] of list.entries()) {
    const where = `scopes[${index}]`;
    if (!isObject(scope)) return fail(`${where} doit être un objet.`);
    const name = cleanString(scope.name);
    if (!name) return fail(`${where} n'a pas de \`name\`.`);
    const authorId = cleanString(scope.id);
    if (authorId) {
      if (seen.has(authorId))
        return fail(`Identifiant de scope en double : ${authorId}.`);
      seen.add(authorId);
    }
    const rawListings = scope.listings ?? [];
    if (!Array.isArray(rawListings))
      return fail(`${where}.listings doit être un tableau.`);
    const listings = [];
    for (const [listingIndex, listing] of rawListings.entries()) {
      const parsed = parseListing(
        listing,
        `${where}.listings[${listingIndex}]`,
        options
      );
      if (!parsed.ok) return parsed;
      listings.push(parsed.listing);
    }
    scopes.push({ id: options.newId(), name, listings });
  }
  return { ok: true, scopes };
}

/**
 * @param {Object} json - content of `projet.json`
 * @param {{pdfPaths: Iterable<string>, newId: () => string}} options
 * @returns {{ok: true, data: Object, summary: Object} | {ok: false, error: string}}
 *   `data` = { coordinateSpace, note, project, baseMaps, scopes } with fresh
 *   ids everywhere and every reference rewritten.
 */
export default function parsePromptIaProjectOutput(json, { pdfPaths, newId }) {
  if (!isObject(json)) return fail("Le JSON doit être un objet.");

  const coordinateSpace = json.coordinateSpace ?? "image";
  if (!COORDINATE_SPACES.includes(coordinateSpace))
    return fail(
      `coordinateSpace inconnu : ${coordinateSpace} (attendu ${COORDINATE_SPACES.join(" ou ")}).`
    );

  const parsedBaseMaps = parseBaseMaps(json.baseMaps, { pdfPaths, newId });
  if (!parsedBaseMaps.ok) return parsedBaseMaps;

  const parsedScopes = parseScopes(json.scopes, {
    baseMapIdMap: parsedBaseMaps.idMap,
    newId,
  });
  if (!parsedScopes.ok) return parsedScopes;

  const { baseMaps } = parsedBaseMaps;
  const { scopes } = parsedScopes;
  if (baseMaps.length === 0 && scopes.length === 0)
    return fail("Le JSON ne décrit ni fond de plan ni scope.");

  const listings = scopes.flatMap((s) => s.listings);
  const summary = {
    scopes: scopes.length,
    baseMaps: baseMaps.length,
    listings: listings.length,
    templates: listings.reduce((n, l) => n + l.annotationTemplates.length, 0),
    annotations: listings.reduce((n, l) => n + l.annotations.length, 0),
  };
  if (summary.annotations > MAX_ANNOTATIONS)
    return fail(`Import limité à ${MAX_ANNOTATIONS} annotations.`);

  return {
    ok: true,
    data: {
      coordinateSpace,
      note: cleanString(json.note) || null,
      project: {
        name: cleanString(json.project?.name) || null,
        clientRef: cleanString(json.project?.clientRef) || null,
      },
      baseMaps,
      scopes,
    },
    summary,
  };
}
