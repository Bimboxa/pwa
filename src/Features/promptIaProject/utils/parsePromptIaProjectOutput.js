// Pure validation / normalization of `projet.json`, the file an external AI
// chat returns (in a zip, next to the PDFs) to create a whole project:
// base maps, scopes, annotation listings, templates and annotations.

import { COORDINATE_SPACES } from "../../promptIa/utils/parsePromptIaOutput.js";
import parsePromptIaBusinessObjects from "../../businessObjects/utils/parsePromptIaBusinessObjects.js";

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
export const MAX_DOCUMENTS = 50;
export const MAX_BUSINESS_OBJECTS = 5000;
export const MAX_ISSUES = 500;
// Types of the business-object listings the json may create. The ISSUE
// listing is not one of them: it is made from `scopes[].issues`.
export const BUSINESS_OBJECT_LISTING_TYPES = ["STANDARD", "NOMENCLATURE"];

export const MIN_PLACEMENT_POINTS = 2;
export const SITE_REFERENCE_TYPES = ["SATELLITE", "BASE_MAP"];
// IGN WMS MaxWidth / MaxHeight
const MAX_REFERENCE_IMAGE_SIZE = 5010;

const ROTATIONS = [0, 90, 180, 270];
// Lambert CC 9 zones, the only projections the satellite reference accepts
// (conformal: one exact meterByPx, see satelliteMap/utils/ccProjection.js).
const CC_CRS = /^EPSG:39(4[2-9]|50)$/;

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

// Resolves a file of `projet.json` against the entries of the zip: exact path
// first, then case-insensitive, then the bare file name when it is
// unambiguous (models often drop the `pdfs/` folder).
export function resolveZipPath(file, zipPaths) {
  const wanted = normalizeZipPath(file);
  if (!wanted) return null;
  const paths = [...(zipPaths ?? [])];
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

export const resolvePdfPath = resolveZipPath;

const isPoint = (p) =>
  isObject(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

// Matching points between a plan and the site reference. Never fatal: a
// placement that cannot be used is dropped with a warning, the base map is
// still created (at the origin).
function parsePlacement(raw, name, warnings) {
  if (raw == null) return null;
  const pairs = Array.isArray(raw?.points) ? raw.points : [];
  const points = pairs
    .filter((pair) => isPoint(pair?.plan) && isPoint(pair?.reference))
    .map((pair) => ({
      plan: { x: pair.plan.x, y: pair.plan.y },
      reference: { x: pair.reference.x, y: pair.reference.y },
    }));
  if (points.length < MIN_PLACEMENT_POINTS) {
    warnings.push(
      `Fond de plan « ${name} » : positionnement ignoré (au moins ${MIN_PLACEMENT_POINTS} points homologues valides attendus).`
    );
    return null;
  }
  return {
    points,
    altitude: Number.isFinite(raw.altitude) ? raw.altitude : 0,
  };
}

function parseReferenceBbox(bbox) {
  const box = Array.isArray(bbox)
    ? { minx: bbox[0], miny: bbox[1], maxx: bbox[2], maxy: bbox[3] }
    : bbox;
  if (!isObject(box)) return null;
  const { minx, miny, maxx, maxy } = box;
  const ok =
    [minx, miny, maxx, maxy].every(Number.isFinite) &&
    minx < maxx &&
    miny < maxy;
  return ok ? { minx, miny, maxx, maxy } : null;
}

function parseSiteReference(raw, { imagePaths, baseMapIdMap, warnings }) {
  if (raw == null) return null;
  const drop = (reason) => {
    warnings.push(`Référence du site ignorée : ${reason}.`);
    return null;
  };
  if (!isObject(raw)) return drop("`site.reference` doit être un objet");

  if (raw.type === "BASE_MAP") {
    if (!baseMapIdMap.has(raw.baseMapId))
      return drop(`baseMapId inconnu (${raw.baseMapId ?? "vide"})`);
    return { type: "BASE_MAP", baseMapId: baseMapIdMap.get(raw.baseMapId) };
  }

  if (raw.type === "SATELLITE") {
    if (!CC_CRS.test(raw.crs ?? ""))
      return drop(
        `crs non pris en charge (${raw.crs ?? "vide"}, attendu EPSG:3942 à EPSG:3950)`
      );
    const bbox = parseReferenceBbox(raw.bbox);
    if (!bbox) return drop("bbox invalide");
    const sizes = [raw.width, raw.height];
    if (
      !sizes.every(
        (v) => Number.isInteger(v) && v > 0 && v <= MAX_REFERENCE_IMAGE_SIZE
      )
    )
      return drop("width / height invalides");
    return {
      type: "SATELLITE",
      // null = image absent from the zip: fetched again from crs + bbox
      file: resolveZipPath(raw.file, imagePaths),
      crs: raw.crs,
      bbox,
      width: raw.width,
      height: raw.height,
      layer: cleanString(raw.layer) || null,
    };
  }

  return drop(
    `type inconnu (${raw.type ?? "vide"}, attendu ${SITE_REFERENCE_TYPES.join(" ou ")})`
  );
}

function parseSite(raw, options) {
  if (!isObject(raw)) return { address: null, latLng: null, reference: null };
  const { lat, lng } = raw.latLng ?? {};
  return {
    address: cleanString(raw.address) || null,
    latLng: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
    reference: parseSiteReference(raw.reference, options),
  };
}

// Only the plan views that carry annotations are located, never a detail nor
// the reference itself.
function keepEligiblePlacements({ baseMaps, scopes, site, warnings }) {
  const annotated = new Set(
    scopes
      .flatMap((s) => s.listings)
      .flatMap((l) => l.annotations)
      .map((a) => a.baseMapId)
  );
  const { reference } = site;
  let missingReference = false;
  for (const baseMap of baseMaps) {
    if (!baseMap.placement) continue;
    let reason = null;
    if (!reference) missingReference = true;
    else if (baseMap.isDetail) reason = "fond de plan de détail";
    else if (baseMap.listing !== "PLAN")
      reason = "ce n'est pas une vue en plan";
    else if (reference.baseMapId === baseMap.id)
      reason = "c'est la référence du site";
    else if (!annotated.has(baseMap.id)) reason = "aucune annotation";
    if (!reference || reason) baseMap.placement = null;
    if (reason)
      warnings.push(
        `Fond de plan « ${baseMap.name} » : positionnement ignoré (${reason}).`
      );
  }
  if (missingReference)
    warnings.push(
      "Positionnements ignorés : aucune référence de site exploitable."
    );
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

function parseBaseMaps(rawBaseMaps, { pdfPaths, newId, warnings }) {
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
    const name = cleanString(bm.name) || `Fond de plan ${index + 1}`;
    baseMaps.push({
      id,
      name,
      listing,
      source: { file, pageNumber, rotation, bboxInRatio: bbox.value },
      blueprintScale: scale,
      // import-time flag only: the record stays a regular base map
      isDetail: bm.isDetail === true,
      placement: parsePlacement(bm.placement, name, warnings),
    });
  }
  return { ok: true, baseMaps, idMap };
}

function parseListing(
  listing,
  where,
  { baseMapIdMap, newId, annotationIdMap, warnings }
) {
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
    const id = newId();
    // author id → new id, for the links of the business objects / issues
    const authorId = cleanString(ann.id);
    if (authorId) {
      if (annotationIdMap.has(authorId))
        warnings.push(
          `Identifiant d'annotation en double : ${authorId} (${where}). Les liens visent la première.`
        );
      else annotationIdMap.set(authorId, id);
    }
    annotations.push({
      ...ann,
      id,
      baseMapId: baseMapIdMap.get(ann.baseMapId),
      annotationTemplateId: templateIdMap.get(ann.annotationTemplateId),
    });
  }

  return {
    ok: true,
    listing: { id: newId(), name, annotationTemplates, annotations },
  };
}

// --- documents, business objects, issues ---
// Nothing here is fatal but a malformed container: a link that cannot be
// resolved is dropped with a warning, the rest is still created.

function parseDocuments(rawDocuments, { filePaths, newId, warnings }) {
  if (rawDocuments != null && !Array.isArray(rawDocuments))
    return fail("`documents` doit être un tableau.");
  const list = rawDocuments ?? [];
  if (list.length > MAX_DOCUMENTS)
    return fail(`Import limité à ${MAX_DOCUMENTS} documents.`);

  const idMap = new Map();
  const documents = [];
  for (const [index, doc] of list.entries()) {
    const where = `documents[${index}]`;
    if (!isObject(doc)) return fail(`${where} doit être un objet.`);
    const authorId = cleanString(doc.id);
    if (!authorId) return fail(`${where} n'a pas d'\`id\`.`);
    if (idMap.has(authorId))
      return fail(`Identifiant de document en double : ${authorId}.`);
    const file = resolveZipPath(doc.file, filePaths);
    if (!file) {
      warnings.push(
        `Document « ${cleanString(doc.name) || authorId} » ignoré : fichier introuvable dans le zip (${doc.file ?? "vide"}).`
      );
      continue;
    }
    const id = newId();
    idMap.set(authorId, id);
    documents.push({
      id,
      name: cleanString(doc.name) || file.split("/").pop(),
      file,
    });
  }
  return { ok: true, documents, idMap };
}

// → ids of the parsed annotations, unknown ones counted in `missing`
function parseAnnotationLinks(raw, { annotationIdMap, missing }) {
  const ids = new Set();
  for (const authorId of Array.isArray(raw) ? raw : []) {
    const id = annotationIdMap.get(cleanString(authorId));
    if (id) ids.add(id);
    else missing.annotations += 1;
  }
  return [...ids];
}

// A link to a document: the whole file, or one of its titles / passages
// (`title`, looked up in the text of the page at import time).
function parseDocumentLinks(raw, { documentIdMap, missing }) {
  const links = [];
  for (const link of Array.isArray(raw) ? raw : []) {
    const documentId = documentIdMap.get(cleanString(link?.documentId));
    if (!documentId) {
      missing.documents += 1;
      continue;
    }
    const { pageNumber } = link;
    links.push({
      documentId,
      pageNumber:
        Number.isInteger(pageNumber) && pageNumber >= 1 ? pageNumber : null,
      title: cleanString(link.title).replace(/\s+/g, " ") || null,
    });
  }
  return links;
}

function parseBusinessObjectListing(listing, where, options) {
  const { newId, warnings, businessObjectIdMap } = options;
  if (!isObject(listing)) return fail(`${where} doit être un objet.`);
  const name = cleanString(listing.name);
  if (!name) return fail(`${where} n'a pas de \`name\`.`);
  const type = listing.type ?? "STANDARD";
  if (!BUSINESS_OBJECT_LISTING_TYPES.includes(type))
    return fail(
      `${where}.type inconnu : ${type} (attendu ${BUSINESS_OBJECT_LISTING_TYPES.join(" ou ")}).`
    );

  const parsed = parsePromptIaBusinessObjects({
    businessObjects: listing.businessObjects,
  });
  if (!parsed.ok) return fail(`${where} : ${parsed.error}`);
  parsed.warnings.forEach((w) => warnings.push(`Liste « ${name} » : ${w}`));

  const rawByRef = new Map();
  for (const raw of listing.businessObjects) {
    const ref = cleanString(raw?.id);
    if (ref && !rawByRef.has(ref)) rawByRef.set(ref, raw);
  }

  const items = parsed.items.map((item) => {
    const id = newId();
    if (!businessObjectIdMap.has(item.ref))
      businessObjectIdMap.set(item.ref, {
        id,
        label: item.label,
        code: item.code,
      });
    const raw = rawByRef.get(item.ref);
    return {
      ...item,
      id,
      annotationIds: parseAnnotationLinks(raw?.annotationIds, options),
      documentLinks: parseDocumentLinks(raw?.documentLinks, options),
    };
  });
  return { ok: true, listing: { id: newId(), name, type, items } };
}

function parseIssues(rawIssues, where, options) {
  if (rawIssues != null && !Array.isArray(rawIssues))
    return fail(`${where} doit être un tableau.`);
  const { businessObjectIdMap, missing, warnings } = options;
  const issues = [];
  let skipped = 0;
  for (const raw of rawIssues ?? []) {
    const label = cleanString(raw?.label).replace(/\s+/g, " ");
    if (!isObject(raw) || !label) {
      skipped += 1;
      continue;
    }
    const businessObjects = [];
    for (const authorId of Array.isArray(raw.businessObjectIds)
      ? raw.businessObjectIds
      : []) {
      const target = businessObjectIdMap.get(cleanString(authorId));
      if (target) businessObjects.push(target);
      else missing.businessObjects += 1;
    }
    issues.push({
      label,
      description: cleanString(raw.description) || null,
      annotationIds: parseAnnotationLinks(raw.annotationIds, options),
      documentLinks: parseDocumentLinks(raw.documentLinks, options),
      businessObjects,
    });
  }
  if (skipped > 0)
    warnings.push(`${where} : ${skipped} point(s) sans libellé ignoré(s).`);
  return { ok: true, issues };
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
    // author ids of the annotations / business objects are scoped to their
    // scope: a link never crosses two scopes
    const scopeOptions = {
      ...options,
      annotationIdMap: new Map(),
      businessObjectIdMap: new Map(),
      missing: { annotations: 0, documents: 0, businessObjects: 0 },
    };
    const listings = [];
    for (const [listingIndex, listing] of rawListings.entries()) {
      const parsed = parseListing(
        listing,
        `${where}.listings[${listingIndex}]`,
        scopeOptions
      );
      if (!parsed.ok) return parsed;
      listings.push(parsed.listing);
    }

    const rawBoListings = scope.businessObjectListings ?? [];
    if (!Array.isArray(rawBoListings))
      return fail(`${where}.businessObjectListings doit être un tableau.`);
    const businessObjectListings = [];
    for (const [listingIndex, listing] of rawBoListings.entries()) {
      const parsed = parseBusinessObjectListing(
        listing,
        `${where}.businessObjectListings[${listingIndex}]`,
        scopeOptions
      );
      if (!parsed.ok) return parsed;
      businessObjectListings.push(parsed.listing);
    }

    const parsedIssues = parseIssues(
      scope.issues,
      `${where}.issues`,
      scopeOptions
    );
    if (!parsedIssues.ok) return parsedIssues;

    const { missing } = scopeOptions;
    const missingS = [
      missing.annotations && `${missing.annotations} annotation(s)`,
      missing.businessObjects && `${missing.businessObjects} ouvrage(s)`,
      missing.documents && `${missing.documents} document(s)`,
    ].filter(Boolean);
    if (missingS.length)
      options.warnings.push(
        `Scope « ${name} » : liens ignorés vers ${missingS.join(", ")} introuvable(s).`
      );

    scopes.push({
      id: options.newId(),
      name,
      listings,
      businessObjectListings,
      issues: parsedIssues.issues,
    });
  }
  return { ok: true, scopes };
}

/**
 * @param {Object} json - content of `projet.json`
 * @param {{pdfPaths: Iterable<string>, imagePaths?: Iterable<string>, filePaths?: Iterable<string>, newId: () => string}} options
 *   `filePaths` = every entry of the zip (documents), the PDFs by default
 * @returns {{ok: true, data: Object, summary: Object} | {ok: false, error: string}}
 *   `data` = { coordinateSpace, note, project, site, baseMaps, documents,
 *   scopes, warnings } with fresh ids everywhere and every reference
 *   rewritten. `baseMaps[].placement` is only kept on the base maps to
 *   locate. Each scope carries `listings` (annotations),
 *   `businessObjectListings` (items of parsePromptIaBusinessObjects + `id`,
 *   `annotationIds`, `documentLinks`) and `issues`.
 */
export default function parsePromptIaProjectOutput(
  json,
  { pdfPaths, imagePaths = [], filePaths = pdfPaths, newId }
) {
  if (!isObject(json)) return fail("Le JSON doit être un objet.");

  const coordinateSpace = json.coordinateSpace ?? "image";
  if (!COORDINATE_SPACES.includes(coordinateSpace))
    return fail(
      `coordinateSpace inconnu : ${coordinateSpace} (attendu ${COORDINATE_SPACES.join(" ou ")}).`
    );

  const warnings = [];

  const parsedBaseMaps = parseBaseMaps(json.baseMaps, {
    pdfPaths,
    newId,
    warnings,
  });
  if (!parsedBaseMaps.ok) return parsedBaseMaps;

  const parsedDocuments = parseDocuments(json.documents, {
    filePaths,
    newId,
    warnings,
  });
  if (!parsedDocuments.ok) return parsedDocuments;

  const parsedScopes = parseScopes(json.scopes, {
    baseMapIdMap: parsedBaseMaps.idMap,
    documentIdMap: parsedDocuments.idMap,
    newId,
    warnings,
  });
  if (!parsedScopes.ok) return parsedScopes;

  const { baseMaps } = parsedBaseMaps;
  const { scopes } = parsedScopes;
  const { documents } = parsedDocuments;
  if (baseMaps.length === 0 && scopes.length === 0)
    return fail("Le JSON ne décrit ni fond de plan ni scope.");

  const site = parseSite(json.site, {
    imagePaths,
    baseMapIdMap: parsedBaseMaps.idMap,
    warnings,
  });
  keepEligiblePlacements({ baseMaps, scopes, site, warnings });

  const listings = scopes.flatMap((s) => s.listings);
  const businessObjectListings = scopes.flatMap(
    (s) => s.businessObjectListings
  );
  const summary = {
    scopes: scopes.length,
    baseMaps: baseMaps.length,
    listings: listings.length,
    templates: listings.reduce((n, l) => n + l.annotationTemplates.length, 0),
    annotations: listings.reduce((n, l) => n + l.annotations.length, 0),
    placements: baseMaps.filter((b) => b.placement).length,
    documents: documents.length,
    businessObjectListings: businessObjectListings.length,
    businessObjects: businessObjectListings.reduce(
      (n, l) => n + l.items.length,
      0
    ),
    issues: scopes.reduce((n, s) => n + s.issues.length, 0),
  };
  if (summary.annotations > MAX_ANNOTATIONS)
    return fail(`Import limité à ${MAX_ANNOTATIONS} annotations.`);
  if (summary.businessObjects > MAX_BUSINESS_OBJECTS)
    return fail(`Import limité à ${MAX_BUSINESS_OBJECTS} ouvrages.`);
  if (summary.issues > MAX_ISSUES)
    return fail(`Import limité à ${MAX_ISSUES} points d'attention.`);

  return {
    ok: true,
    data: {
      coordinateSpace,
      note: cleanString(json.note) || null,
      project: {
        name: cleanString(json.project?.name) || null,
        clientRef: cleanString(json.project?.clientRef) || null,
      },
      site,
      baseMaps,
      documents,
      scopes,
      warnings,
    },
    summary,
  };
}
