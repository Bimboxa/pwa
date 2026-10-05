// Painted parts as the quantity consumers see them — node-testable (relative
// imports only).
//
// 1. resolveMeshPaints drops what is not effective (deleted template /
//    listing / host, incompatible template type, provisional copies) and
//    gives each row its status (OK / ORPHAN / CONFLICT) + stale flag.
// 2. The consumer's filters are applied with the SAME semantics (and names)
//    as useAnnotationsV2 — and the same rules as the 3D layer
//    (getMeshPaintVisibility) — with two deliberate differences:
//    - template / listing / scope filters test the paint's OWN template and
//      listing (the painting template); the host's template and listing are
//      ignored, so hiding the wall's template keeps its plaster listed and
//      counted;
//    - layer filters test the HOST's layer: hiding a level hides its
//      finishes.
// 3. Each surviving part gets its own quantity (getMeshPaintPartQties). Every
//    listed part carries it (the detail list strikes it through); only
//    `isCounted` parts are summed (aggregatePaintedPartsByTemplate).
import {
  MESH_PAINT_PART_TYPES,
  MESH_PAINT_STATUS,
} from "../constants/meshPaintConstants.js";
import resolveMeshPaints from "./resolveMeshPaints.js";
import getMeshPaintPartQties from "./getMeshPaintPartQties.js";

const toSet = (value) => {
  if (!value) return null;
  if (value instanceof Set) return value;
  return new Set(value);
};

const getMetrics = (metricsByBaseMapId, baseMapId) => {
  if (!metricsByBaseMapId || !baseMapId) return null;
  if (metricsByBaseMapId instanceof Map)
    return metricsByBaseMapId.get(baseMapId) ?? null;
  return metricsByBaseMapId[baseMapId] ?? null;
};

// Stored points [nx, ny, z] of a part (contours, holes, edge ends).
function getStoredPoints(partType, geometry) {
  if (!geometry) return [];
  if (partType === MESH_PAINT_PART_TYPES.EDGE) return geometry.points ?? [];
  if (Array.isArray(geometry.vertices)) return geometry.vertices;
  const points = [];
  for (const polygon of geometry.polygons ?? []) {
    for (const p of polygon?.contour ?? []) points.push(p);
    for (const hole of polygon?.holes ?? [])
      for (const p of hole) points.push(p);
  }
  return points;
}

// Same rule as filterAnnotationsByViewBox: bbox in reference image pixels,
// unknown box (no metrics / no point) → kept.
function intersectsViewBox(row, metrics, viewBox) {
  if (!viewBox || !metrics) return true;
  const points = getStoredPoints(row.partType, row.geometry);
  if (points.length === 0) return true;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    const x = p?.[0] * metrics.imageWidth;
    const y = p?.[1] * metrics.imageHeight;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (minX === Infinity) return true;
  return (
    maxX >= viewBox.x &&
    minX <= viewBox.x + viewBox.width &&
    maxY >= viewBox.y &&
    minY <= viewBox.y + viewBox.height
  );
}

function toNormal(n) {
  if (!Array.isArray(n) || n.length < 3) return null;
  const [x, y, z] = n.map(Number);
  const len = Math.hypot(x, y, z);
  if (!Number.isFinite(len) || len < 1e-12) return null;
  return { x: x / len, y: y / len, z: z / len };
}

/**
 * @param {Object} params
 * @param {Array<Object>} params.rows - db.meshPaints rows (useMeshPaints).
 * @param {Object<string, Object>} params.hostById - RAW host rows.
 * @param {Object<string, Object>} params.templateById - templates, `hidden`
 *   resolved (useAnnotationTemplates).
 * @param {Object<string, Object>} params.listingById - RAW listings.
 * @param {Object<string, Object>|Map} params.metricsByBaseMapId - see
 *   getMeshPaintMetricsByBaseMapId.
 * @param {Object<string, Object>} [params.baseMapById] - names and
 *   orientations only.
 * @param {Object} [params.resolved] - precomputed resolveMeshPaints result
 *   (skips the conflict pass).
 * @param {Object} [params.filters]
 * @param {string|null} [params.filters.scopeId] - filterBySelectedScope:
 *   OWN listing of the scope, or linked into it (useAnnotationsV2 rule).
 * @param {Array|Set} [params.filters.linkedListingIds] - listings linked into
 *   the selected scope from other scopes.
 * @param {Array|Set|null} [params.filters.baseMapIds] - kept base maps (null:
 *   all).
 * @param {Array|Set} [params.filters.excludeBaseMapIds]
 * @param {Array|Set} [params.filters.excludeListingsIds] - OWN listing.
 * @param {boolean} [params.filters.excludeIsForBaseMapsListings]
 * @param {boolean} [params.filters.onlyIsForBaseMapsListings]
 * @param {boolean} [params.filters.keepHiddenTemplates] - OWN template eye.
 * @param {boolean} [params.filters.excludeProfileTemplates]
 * @param {Array|Set} [params.filters.disabledAnnotationTemplates]
 * @param {Array|Set} [params.filters.hiddenLayerIds] - HOST layer.
 * @param {boolean} [params.filters.showAnnotationsWithoutLayer=true]
 * @param {Array|Set} [params.filters.disabledLayerIds] - HOST layer,
 *   "__no_layer__" for hosts without layer.
 * @param {string|null} [params.filters.povFreezeCreatedBefore]
 * @param {{x, y, width, height}|null} [params.filters.viewBox] - reference
 *   image pixels.
 * @returns {Array<Object>} painted parts (see the object built below).
 */
export default function resolvePaintedParts({
  rows,
  hostById,
  templateById,
  listingById,
  metricsByBaseMapId,
  baseMapById,
  resolved,
  filters = {},
}) {
  if (!rows?.length && !resolved?.items?.length) return [];

  const { items } =
    resolved ??
    resolveMeshPaints({
      rows,
      hostById,
      templateById,
      listingById,
      metricsByBaseMapId,
    });

  const scopeId = filters.scopeId ?? null;
  const linkedListingIds = toSet(filters.linkedListingIds);
  const baseMapIds = toSet(filters.baseMapIds);
  const excludeBaseMapIds = toSet(filters.excludeBaseMapIds);
  const excludeListingsIds = toSet(filters.excludeListingsIds);
  const disabledTemplateIds = toSet(filters.disabledAnnotationTemplates);
  const hiddenLayerIds = toSet(filters.hiddenLayerIds);
  const disabledLayerIds = toSet(filters.disabledLayerIds);
  const showAnnotationsWithoutLayer =
    filters.showAnnotationsWithoutLayer ?? true;
  const povFreezeCreatedBefore = filters.povFreezeCreatedBefore ?? null;

  const parts = [];

  for (const item of items ?? []) {
    const { row, host, template, status } = item;
    if (!row) continue;
    const listing = listingById?.[row.listingId] ?? null;

    // -- scope: the OWN listing's (or linked into the scope) --
    if (
      scopeId &&
      (listing?.scopeId ?? row.scopeId) !== scopeId &&
      !linkedListingIds?.has(row.listingId)
    )
      continue;

    // -- base maps --
    if (baseMapIds && !baseMapIds.has(row.baseMapId)) continue;
    if (excludeBaseMapIds?.has(row.baseMapId)) continue;

    // -- OWN listing --
    if (excludeListingsIds?.has(row.listingId)) continue;
    if (filters.excludeIsForBaseMapsListings && listing?.isForBaseMaps)
      continue;
    if (filters.onlyIsForBaseMapsListings && !listing?.isForBaseMaps) continue;

    // -- OWN template --
    if (!filters.keepHiddenTemplates && template?.hidden) continue;
    if (filters.excludeProfileTemplates && template?.isProfile) continue;
    if (disabledTemplateIds?.has(row.annotationTemplateId)) continue;

    // -- HOST: never a base map annotation (not built in 3D), layer --
    if (host?.isBaseMapAnnotation) continue;
    const layerId = host?.layerId ?? null;
    if (!layerId ? !showAnnotationsWithoutLayer : hiddenLayerIds?.has(layerId))
      continue;
    if (disabledLayerIds?.has(layerId ?? "__no_layer__")) continue;

    // -- POV freeze (the paint, or its host, created after the view) --
    const createdAt = row.createdAt ?? row.paintedAt ?? null;
    if (
      povFreezeCreatedBefore &&
      ((createdAt && createdAt > povFreezeCreatedBefore) ||
        (host?.createdAt && host.createdAt > povFreezeCreatedBefore))
    )
      continue;

    // -- view box --
    const metrics = getMetrics(metricsByBaseMapId, row.baseMapId);
    if (!intersectsViewBox(row, metrics, filters.viewBox)) continue;

    const qties = getMeshPaintPartQties(row, metrics);

    parts.push({
      id: row.id,
      row,
      host: host ?? null,
      template: template ?? null,
      listing,
      status,
      isCounted: status === MESH_PAINT_STATUS.OK,
      isOrphan: status === MESH_PAINT_STATUS.ORPHAN,
      isConflict: status === MESH_PAINT_STATUS.CONFLICT,
      isStale: Boolean(item.isStale),
      partType: row.partType,
      annotationTemplateId: row.annotationTemplateId,
      listingId: row.listingId,
      listingName: listing?.name || "-?-",
      baseMapId: row.baseMapId,
      baseMapName: baseMapById?.[row.baseMapId]?.name ?? null,
      // Frame of `normal`: HORIZONTAL = local z up, VERTICAL (elevation) =
      // local y up, local z toward the elevation's viewer.
      baseMapOrientation:
        baseMapById?.[row.baseMapId]?.orientation ?? "HORIZONTAL",
      layerId,
      hostAnnotationId: row.hostAnnotationId,
      hostTemplateId: host?.annotationTemplateId ?? null,
      scopeId: row.scopeId ?? null,
      createdAt,
      paintedAt: row.paintedAt ?? null,
      hidden: Boolean(template?.hidden),
      // FACE: local unit normal toward the painted side (side label).
      normal:
        row.partType === MESH_PAINT_PART_TYPES.FACE
          ? toNormal(row.geometry?.normal)
          : null,
      qtiesEnabled: qties.enabled,
      surface: qties.surface,
      length: qties.length,
    });
  }

  return parts;
}

/**
 * Display label of the host of each painted part, numbered like the
 * template's annotations list of the panels (PanelTemplateAnnotations): the
 * host's OWN label, else "<host template> NN" with NN its draw-order rank
 * among `annotations` of the same template, else the host template label.
 *
 * @param {Object} params
 * @param {Array<Object>} params.parts - resolvePaintedParts output.
 * @param {Array<Object>} params.annotations - the annotations the panel lists
 *   (numbering scope).
 * @param {Object<string, Object>} params.templateById
 * @returns {Object<string, string>} hostAnnotationId → label
 */
export function getPaintedPartHostLabelById({
  parts,
  annotations,
  templateById,
}) {
  const out = {};
  if (!parts?.length) return out;

  const hostIds = new Set(parts.map((p) => p.hostAnnotationId));
  const annotationById = new Map();
  const hostTemplateIds = new Set();
  for (const a of annotations ?? []) {
    if (!hostIds.has(a?.id)) continue;
    annotationById.set(a.id, a);
    if (a.annotationTemplateId) hostTemplateIds.add(a.annotationTemplateId);
  }

  // draw-order rank within the host's template
  const byTemplateId = {};
  for (const a of annotations ?? []) {
    if (!hostTemplateIds.has(a?.annotationTemplateId)) continue;
    if (!byTemplateId[a.annotationTemplateId])
      byTemplateId[a.annotationTemplateId] = [];
    byTemplateId[a.annotationTemplateId].push(a);
  }
  const rankById = new Map();
  for (const list of Object.values(byTemplateId)) {
    list
      .sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""))
      .forEach((a, index) => rankById.set(a.id, index + 1));
  }

  for (const part of parts) {
    const hostId = part.hostAnnotationId;
    if (!hostId || out[hostId]) continue;
    const host = annotationById.get(hostId) ?? part.host;
    // getAnnotationOwnLabel: the row's own label, not the entity-enriched one
    const ownLabel = host?.annotationLabel ?? host?.label;
    const hostTemplateLabel = templateById?.[host?.annotationTemplateId]?.label;
    const rank = rankById.get(hostId);
    out[hostId] =
      ownLabel ||
      (hostTemplateLabel && rank
        ? `${hostTemplateLabel} ${String(rank).padStart(2, "0")}`
        : hostTemplateLabel) ||
      "Annotation";
  }
  return out;
}
