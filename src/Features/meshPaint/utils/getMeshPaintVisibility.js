// Pure 3D display rule of a painted mesh part (« Pinceau », MESH_BRUSH) —
// node-testable, relative imports only.
//
// Mirrors, for a paint, the filters the 3D viewer applies to its annotations
// (useAutoLoadAnnotationsInThreedEditor → useAnnotationsV2 options, then
// ThreedAnnotationsVisibility / ThreedSelectionDimmer), with ONE deliberate
// difference: the HOST's template and listing are never read. A paint is a
// finish of its own template: it stays visible when its host's template or
// listing is hidden (and the host itself is not built), and disappears when
// its OWN template / listing is hidden. The host's LAYER is followed (hiding
// a level hides its finishes), like its base map — and like the REVOLUTION
// AXIS the host is revolved around: the eye / solo of an axis row covers
// everything built on the axis, the paints of its surfaces included.
import getRevolutionAxisIdOfAnnotation from "../../revolutionAxes/utils/getRevolutionAxisIdOfAnnotation.js";
import {
  MESH_PAINT_STATUS,
  MESH_PAINT_SYNC_STATES,
} from "../constants/meshPaintConstants.js";

export const MESH_PAINT_VISIBILITY = Object.freeze({
  HIDDEN: "HIDDEN",
  DIMMED: "DIMMED",
  VISIBLE: "VISIBLE",
});

const { HIDDEN, DIMMED, VISIBLE } = MESH_PAINT_VISIBILITY;

// Set | Array | plain object keyed by id | null.
function has(collection, id) {
  if (!collection || id === undefined || id === null) return false;
  if (collection instanceof Set || collection instanceof Map)
    return collection.has(id);
  if (Array.isArray(collection)) return collection.includes(id);
  return Boolean(collection[id]);
}

function getById(collection, id) {
  if (!collection || id === undefined || id === null) return undefined;
  if (collection instanceof Map) return collection.get(id);
  return collection[id];
}

// useAnnotationsV2 layer filter, applied to the HOST row.
function isHostLayerVisible(host, ctx) {
  if (host.isBaseMapAnnotation) return true;
  if (!host.layerId) return ctx.showAnnotationsWithoutLayer ?? true;
  return !has(ctx.hiddenLayerIds, host.layerId);
}

// useAnnotationsV2 scope filter, applied to the paint's OWN listing: the
// selected scope's listings plus the listings linked into it from another
// scope. No scope selected → no filter.
function isListingInScope(listing, ctx) {
  if (!ctx.scopeId) return true;
  if (!listing) return false;
  return (
    listing.scopeId === ctx.scopeId || has(ctx.linkedListingIds, listing.id)
  );
}

// useAnnotationsV2 POV freeze: rows created after the restored view's
// generation date are dropped (ISO strings: plain comparison is correct).
function isAfterPovFreeze(createdAt, freeze) {
  return Boolean(freeze && createdAt && createdAt > freeze);
}

/**
 * 3D display state of a resolved paint (an item of resolveMeshPaints).
 *
 * @param {{row: Object, status?: string, host?: Object, template?: Object}} item
 *   row: the db.meshPaints row; host: the RAW host annotation row; template:
 *   the paint's OWN template (its `hidden` flag, when set by
 *   useAnnotationTemplates, counts as hidden).
 * @param {Object} ctx — every field optional:
 *   - mainBaseMapId: s.mapEditor.selectedBaseMapId
 *   - baseMapModeById: s.threedEditor.annotationsModeByBaseMapIdIn3d
 *     ({id: "NORMAL" | "DIMMED"}; a missing key / "NONE" = not loaded)
 *   - hideAnnotationsIn3d, hideMainBaseMapAnnotationsIn3d: booleans
 *   - hiddenTemplateIds: Set | Array (selectHiddenAnnotationTemplateIdSet)
 *   - hiddenListingIds: Set | Array (s.listings.hiddenListingsIds)
 *   - listingById: {id: listing} | Map — the paints' OWN listings (raw rows)
 *   - isBaseMapsModule: s.viewers.selectedViewerKey === "BASE_MAPS"
 *   - showAnnotationsInBaseMaps: s.baseMapEditor.showAnnotations
 *   - excludeProfileTemplates: default true (3D drops profile templates)
 *   - scopeId: selected scope id; linkedListingIds: Set | Array
 *   - hiddenLayerIds: Set | Array; showAnnotationsWithoutLayer: default true
 *   - povFreezeCreatedBefore: ISO string | null
 *   - showMeshCells: boolean; meshCellParentIds: Set | Array (useMeshCellRelations)
 *   - soloAnnotationTemplateId, soloAnnotationId: ids | null
 *   - soloRevolutionAxisId: id | null — reads the HOST's axis (the axis eye
 *     hides the axis line only, never the paints of what is revolved around it)
 *   - soloZone: {templateId} | null; zoneSoloAnnotationIds: Set | Array
 *   - soloWorkPackageId: id | null (pass null in planning Play mode);
 *     workPackageSoloAnnotationIds: Set | Array
 *   - soloBusinessObjectId: id | null; businessObjectSoloAnnotationIds: Set | Array
 * @returns {"HIDDEN" | "DIMMED" | "VISIBLE"}
 */
export default function getMeshPaintVisibility(item, ctx = {}) {
  const row = item?.row;
  const host = item?.host;
  if (!row || row.deletedAt || !host || host.deletedAt) return HIDDEN;

  // Same part painted twice (Krto merge): only the winner is drawn.
  if (item.status === MESH_PAINT_STATUS.CONFLICT) return HIDDEN;

  // --- own template / own listing (never the host's) ---
  const templateId = row.annotationTemplateId;
  const template = item.template;
  if (has(ctx.hiddenTemplateIds, templateId) || template?.hidden === true)
    return HIDDEN;
  if ((ctx.excludeProfileTemplates ?? true) && template?.isProfile)
    return HIDDEN;
  if (has(ctx.hiddenListingIds, row.listingId)) return HIDDEN;

  const listing = getById(ctx.listingById, row.listingId);
  // isForBaseMaps partition (excludeIsForBaseMapsListings /
  // onlyIsForBaseMapsListings of the 3D load).
  const isForBaseMaps = Boolean(listing?.isForBaseMaps);
  if (!ctx.isBaseMapsModule && isForBaseMaps) return HIDDEN;
  if (ctx.isBaseMapsModule && !ctx.showAnnotationsInBaseMaps && !isForBaseMaps)
    return HIDDEN;
  if (!isListingInScope(listing, ctx)) return HIDDEN;

  // --- base map: the main one, or an extra one whose annotations are on ---
  const baseMapId = row.baseMapId;
  const isMain = Boolean(baseMapId) && baseMapId === ctx.mainBaseMapId;
  const mode = isMain ? "NORMAL" : getById(ctx.baseMapModeById, baseMapId);
  if (!mode || mode === "NONE") return HIDDEN;
  if (isMain && ctx.hideMainBaseMapAnnotationsIn3d) return HIDDEN;
  if (ctx.hideAnnotationsIn3d) return HIDDEN;

  // --- host: structural filters only (no template / listing) ---
  if (host.isBaseMapAnnotation) return HIDDEN;
  if (!isHostLayerVisible(host, ctx)) return HIDDEN;
  if (ctx.showMeshCells) {
    // The parent is replaced by its mesh cells.
    if (has(ctx.meshCellParentIds, host.id)) return HIDDEN;
  } else if (host.isMeshCell) {
    return HIDDEN;
  }

  // --- POV freeze ---
  const freeze = ctx.povFreezeCreatedBefore;
  if (isAfterPovFreeze(row.createdAt, freeze)) return HIDDEN;
  if (isAfterPovFreeze(host.createdAt, freeze)) return HIDDEN;

  // --- dimmed ---
  if (!isMain && mode === "DIMMED") return DIMMED;
  if (
    item.status === MESH_PAINT_STATUS.ORPHAN ||
    row.sync?.state === MESH_PAINT_SYNC_STATES.ORPHAN
  )
    return DIMMED;

  // Solos dim (keepSoloDimmed) what they leave out: the template solo reads
  // the paint's OWN template, the others the host annotation (the zone /
  // work package / business object links target annotations).
  if (ctx.soloZone) {
    const inZone =
      templateId === ctx.soloZone.templateId ||
      has(ctx.zoneSoloAnnotationIds, host.id);
    if (!inZone) return DIMMED;
  }
  if (ctx.soloWorkPackageId && !has(ctx.workPackageSoloAnnotationIds, host.id))
    return DIMMED;
  if (
    ctx.soloBusinessObjectId &&
    !has(ctx.businessObjectSoloAnnotationIds, host.id)
  )
    return DIMMED;
  if (
    ctx.soloAnnotationTemplateId &&
    templateId !== ctx.soloAnnotationTemplateId
  )
    return DIMMED;
  if (ctx.soloAnnotationId && host.id !== ctx.soloAnnotationId) return DIMMED;
  if (
    ctx.soloRevolutionAxisId &&
    getRevolutionAxisIdOfAnnotation(host) !== ctx.soloRevolutionAxisId
  )
    return DIMMED;

  return VISIBLE;
}
