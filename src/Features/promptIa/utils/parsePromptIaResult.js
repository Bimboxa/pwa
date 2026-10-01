// Pure validation of the EXTENDED part of a Prompt IA result (chat flow): the
// base maps the model created from CAD / BIM sources (`baseMaps[]` with
// `kind: "plan"`, their file in the returned zip), the annotation listings it
// adds to the current scope (`listings[]`) and its issues (`issues[]`).
//
// The historical keys (`annotationTemplates`, `annotations`, detail
// `baseMaps`: displayed base map + current listing) are left untouched in
// `legacy`, for normalizePromptIaPayload.

import {
  MAX_ANNOTATIONS,
  MAX_ISSUES,
  parseIssues,
  parseListing,
  resolveZipPath,
} from "../../promptIaProject/utils/parsePromptIaProjectOutput.js";
import { parseWorldFrame } from "./worldFrame.js";

export const MAX_PLAN_BASE_MAPS = 20;
export const MAX_LISTINGS = 50;
export const LISTING_COORDINATE_SPACES = ["world", "image"];
const PLAN_FILE = /\.(pdf|png|jpe?g)$/i;

const fail = (error) => ({ ok: false, error });

const isObject = (v) =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

const cleanString = (v) => (typeof v === "string" ? v.trim() : "");

export const isPlanBaseMap = (bm) => isObject(bm) && bm.kind === "plan";

// True when the json asks for more than the historical import can do.
export function hasExtendedKeys(json) {
  if (!isObject(json)) return false;
  return (
    (Array.isArray(json.listings) && json.listings.length > 0) ||
    (Array.isArray(json.issues) && json.issues.length > 0) ||
    (Array.isArray(json.baseMaps) && json.baseMaps.some(isPlanBaseMap))
  );
}

// Every x / y of the geometry of an annotation.
function* iteratePoints(annotation) {
  for (const p of annotation.points ?? []) if (isObject(p)) yield p;
  for (const key of ["cuts", "openings", "guideLines"])
    for (const item of annotation[key] ?? [])
      for (const p of item?.points ?? []) if (isObject(p)) yield p;
  for (const key of ["labelPoint", "targetPoint", "point"])
    if (isObject(annotation[key])) yield annotation[key];
}

// A listing that does not say its coordinate space: normalized values all
// sit in [0, 1], source coordinates (metres of a CAD file) never do.
export function guessListingCoordinateSpace(annotations) {
  let seen = false;
  for (const annotation of annotations ?? [])
    for (const p of iteratePoints(annotation)) {
      seen = true;
      if (p.x < -0.01 || p.x > 1.01 || p.y < -0.01 || p.y > 1.01)
        return "world";
    }
  return seen ? "image" : "world";
}

function parsePlanBaseMaps(rawBaseMaps, { zipPaths, newId }) {
  const list = (rawBaseMaps ?? []).filter(isPlanBaseMap);
  if (list.length > MAX_PLAN_BASE_MAPS)
    return fail(`Import limité à ${MAX_PLAN_BASE_MAPS} fonds de plan créés.`);
  if (list.length && !zipPaths)
    return fail(
      "Ce résultat crée des fonds de plan : déposez le zip renvoyé par l’IA (resultat.json + fichiers des fonds), pas le JSON seul."
    );

  const idMap = new Map();
  const baseMaps = [];
  for (const [index, bm] of list.entries()) {
    const authorId = cleanString(bm.id);
    const where = `baseMaps « ${authorId || index + 1} »`;
    if (!authorId) return fail(`Un fond de plan créé n'a pas d'\`id\`.`);
    if (idMap.has(authorId))
      return fail(`Identifiant de fond de plan en double : ${authorId}.`);

    const source = bm.source;
    if (!isObject(source)) return fail(`${where} : \`source\` manquant.`);
    const planPaths = zipPaths.filter((p) => PLAN_FILE.test(p));
    const file = resolveZipPath(source.file, planPaths);
    if (!file)
      return fail(
        `${where} : fichier introuvable dans le zip (${source.file ?? "vide"}, PDF ou PNG attendu).`
      );
    const isPdf = /\.pdf$/i.test(file);
    const pageNumber = source.pageNumber ?? 1;
    if (isPdf && (!Number.isInteger(pageNumber) || pageNumber < 1))
      return fail(`${where} : source.pageNumber doit être un entier ≥ 1.`);

    const world = parseWorldFrame(bm.world);
    if (!world.ok) return fail(`${where} : ${world.error}`);

    const id = newId();
    idMap.set(authorId, id);
    baseMaps.push({
      id,
      authorId,
      name: cleanString(bm.name) || `Fond de plan ${index + 1}`,
      source: { file, isPdf, pageNumber: isPdf ? pageNumber : null },
      // attachment the base map was drawn from, when the model says so
      sourceAttachmentId: cleanString(bm.sourceAttachmentId) || null,
      world: world.frame,
    });
  }
  return { ok: true, baseMaps, idMap };
}

/**
 * @param {Object} json - the result of the model (`resultat.json`, or the
 *   pasted JSON)
 * @param {Object} options
 * @param {string[]|null} options.zipPaths - entries of the returned zip
 *   (json excluded); null when the result was pasted
 * @param {Iterable<string>} [options.attachmentIds] - ids of the attachments
 *   of the input zip (contexte.json), the only valid `documentLinks` targets
 * @param {() => string} options.newId
 * @returns {{ok: true, legacy: Object|null, baseMaps: Object[],
 *   listings: Object[], issues: Object[], warnings: string[], note: string|null,
 *   summary: Object} | {ok: false, error: string}}
 *   `legacy` = the json without the extended keys, null when it carries no
 *   historical content. Every id of the extended part is reminted; an issue
 *   links annotations by parsed id (listings) or by author id (legacy part).
 */
export default function parsePromptIaResult(
  json,
  { zipPaths = null, attachmentIds = [], newId }
) {
  if (!isObject(json)) return fail("Le JSON doit être un objet.");
  for (const key of ["baseMaps", "listings", "issues"])
    if (json[key] != null && !Array.isArray(json[key]))
      return fail(`\`${key}\` doit être un tableau.`);

  const warnings = [];

  const parsedBaseMaps = parsePlanBaseMaps(json.baseMaps, { zipPaths, newId });
  if (!parsedBaseMaps.ok) return parsedBaseMaps;
  const { baseMaps, idMap: baseMapIdMap } = parsedBaseMaps;
  const baseMapById = new Map(baseMaps.map((b) => [b.id, b]));

  // legacy part: everything but the extended keys
  const { listings: rawListings, issues: rawIssues, ...rest } = json;
  const detailBaseMaps = (json.baseMaps ?? []).filter((b) => !isPlanBaseMap(b));
  const legacyAnnotations = Array.isArray(json.annotations)
    ? json.annotations
    : [];
  const hasLegacy = legacyAnnotations.length > 0 || detailBaseMaps.length > 0;
  const legacy = hasLegacy ? { ...rest } : null;
  if (legacy) {
    if (detailBaseMaps.length) legacy.baseMaps = detailBaseMaps;
    else delete legacy.baseMaps;
  }

  // author id → parsed id: the legacy annotations keep their author id (the
  // import reports the written id against it)
  const annotationIdMap = new Map();
  for (const annotation of legacyAnnotations) {
    const authorId = cleanString(annotation?.id);
    if (authorId && !annotationIdMap.has(authorId))
      annotationIdMap.set(authorId, authorId);
  }

  if ((rawListings ?? []).length > MAX_LISTINGS)
    return fail(`Import limité à ${MAX_LISTINGS} listes.`);
  const listings = [];
  for (const [index, raw] of (rawListings ?? []).entries()) {
    const where = `listings[${index}]`;
    const parsed = parseListing(raw, where, {
      baseMapIdMap,
      newId,
      annotationIdMap,
      warnings,
    });
    if (!parsed.ok) return parsed;
    const space =
      raw.coordinateSpace ??
      guessListingCoordinateSpace(parsed.listing.annotations);
    if (!LISTING_COORDINATE_SPACES.includes(space))
      return fail(
        `${where}.coordinateSpace inconnu : ${space} (attendu ${LISTING_COORDINATE_SPACES.join(" ou ")}).`
      );
    listings.push({
      ...parsed.listing,
      coordinateSpace: space,
      // attachment the listing was extracted from, when the model says so
      sourceAttachmentId: cleanString(raw.sourceAttachmentId) || null,
    });
  }

  const documentIdMap = new Map([...attachmentIds].map((id) => [id, id]));
  const missing = { annotations: 0, documents: 0, businessObjects: 0 };
  const parsedIssues = parseIssues(
    (rawIssues ?? []).map((issue) =>
      isObject(issue)
        ? {
            ...issue,
            documentLinks: (Array.isArray(issue.documentLinks)
              ? issue.documentLinks
              : []
            ).map((link) => ({
              ...link,
              documentId: link?.attachmentId ?? link?.documentId,
            })),
          }
        : issue
    ),
    "issues",
    {
      annotationIdMap,
      documentIdMap,
      businessObjectIdMap: new Map(),
      missing,
      warnings,
    }
  );
  if (!parsedIssues.ok) return parsedIssues;
  const missingS = [
    missing.annotations && `${missing.annotations} annotation(s)`,
    missing.documents && `${missing.documents} pièce(s) jointe(s)`,
  ].filter(Boolean);
  if (missingS.length)
    warnings.push(
      `Points d'attention : liens ignorés vers ${missingS.join(", ")} introuvable(s).`
    );

  const annotations = listings.reduce((n, l) => n + l.annotations.length, 0);
  if (annotations > MAX_ANNOTATIONS)
    return fail(`Import limité à ${MAX_ANNOTATIONS} annotations.`);
  if (parsedIssues.issues.length > MAX_ISSUES)
    return fail(`Import limité à ${MAX_ISSUES} points d'attention.`);

  const usedBaseMapIds = new Set(
    listings.flatMap((l) => l.annotations.map((a) => a.baseMapId))
  );
  for (const baseMap of baseMaps)
    if (!usedBaseMapIds.has(baseMap.id))
      warnings.push(
        `Fond de plan « ${baseMap.name} » : aucune annotation ne le vise.`
      );

  return {
    ok: true,
    legacy,
    baseMaps,
    baseMapById,
    listings,
    issues: parsedIssues.issues,
    warnings,
    note: cleanString(json.note) || null,
    summary: {
      baseMaps: baseMaps.length,
      listings: listings.length,
      templates: listings.reduce((n, l) => n + l.annotationTemplates.length, 0),
      annotations,
      issues: parsedIssues.issues.length,
    },
  };
}
