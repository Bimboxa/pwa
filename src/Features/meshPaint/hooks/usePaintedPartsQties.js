import { useMemo, useRef } from "react";
import { useSelector } from "react-redux";

import useMeshPaints from "./useMeshPaints";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import resolvePaintedParts from "Features/meshPaint/utils/resolvePaintedParts";
import aggregatePaintedPartsByTemplate from "Features/meshPaint/utils/aggregatePaintedPartsByTemplate";
import { getMeshPaintMetricsByBaseMapId } from "Features/meshPaint/utils/getMeshPaintMetrics";
import { selectPovFreezeCreatedBefore } from "Features/viewers/utils/effectiveViewerKey";
import { selectLinkedListingSourceForSelectedScope } from "Features/listings/selectors/listingsSelectors";

/**
 * Painted parts (« Pinceau » 3D, db.meshPaints) of the selected project with
 * their quantities, filtered like a useAnnotationsV2 call: a consumer passes
 * the SAME options object it gives useAnnotationsV2 (+ the extras below) so
 * its painted totals cover the same scope as its annotation totals.
 *
 * Options (useAnnotationsV2 names):
 *   enabled, filterByMainBaseMap, filterByBaseMapId, extraBaseMapIds,
 *   filterBySelectedScope, excludeListingsIds (OWN listing),
 *   excludeIsForBaseMapsListings, onlyIsForBaseMapsListings,
 *   keepHiddenTemplates (OWN template eye), excludeProfileTemplates.
 *   Layers (HOST layer) and the POV freeze always apply, like in
 *   useAnnotationsV2. Other useAnnotationsV2 options are ignored.
 * Extras:
 *   excludeBaseMapIds (e.g. the main base map when its annotations are
 *   hidden in 3D), viewBox (reference image px), disabledAnnotationTemplates,
 *   disabledLayerIds ("__no_layer__" rule).
 * Inputs a caller already holds (saves this hook's own live queries):
 *   annotationTemplates (useAnnotationTemplates() result), baseMaps
 *   (useBaseMaps({includeDetails: true}) value). Without any painted part in
 *   the project, the templates / base maps are not queried at all.
 *
 * The result keeps its identity while its content is unchanged (frozen EMPTY
 * result without painted part), so merged quantities do not re-render the
 * panels on unrelated writes.
 *
 * @returns {{
 *   parts: Array<Object>,                       // resolvePaintedParts items
 *   qtiesByTemplateId: Object<string, Object>,  // aggregatePaintedPartsByTemplate(...).byTemplateId
 *   partsByTemplateId: Object<string, Array<Object>>,
 *   templateIds: Set<string>,                   // templates with a listed part
 *   listingIds: Set<string>,                    // own listings with a listed part
 *   countsByListingId: Object<string, number>,  // counted parts per own listing
 * }}
 */
export default function usePaintedPartsQties(options) {
  // options

  const enabled = options?.enabled ?? true;
  const filterByMainBaseMap = options?.filterByMainBaseMap;
  const filterByBaseMapId = options?.filterByBaseMapId;
  const filterBySelectedScope = options?.filterBySelectedScope;
  const excludeIsForBaseMapsListings = options?.excludeIsForBaseMapsListings;
  const onlyIsForBaseMapsListings = options?.onlyIsForBaseMapsListings;
  const keepHiddenTemplates = options?.keepHiddenTemplates;
  const excludeProfileTemplates = options?.excludeProfileTemplates;

  // Array / object options are keyed by content: callers often pass inline
  // literals.
  const extraBaseMapIdsKey = toKey(options?.extraBaseMapIds);
  const excludeBaseMapIdsKey = toKey(options?.excludeBaseMapIds);
  const excludeListingsIdsKey = toKey(options?.excludeListingsIds);
  const disabledTemplatesKey = toKey(options?.disabledAnnotationTemplates);
  const disabledLayerIdsKey = toKey(options?.disabledLayerIds);
  const viewBox = options?.viewBox;
  const viewBoxKey = viewBox
    ? [viewBox.x, viewBox.y, viewBox.width, viewBox.height].join(",")
    : "";

  // data

  const mainBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  // Listings linked into the selected scope (their paints pass the scope
  // filter, like their annotations) — content key.
  const linkedListingSourceByListingId = useSelector(
    selectLinkedListingSourceForSelectedScope
  );
  const linkedListingIdsKey = useMemo(
    () =>
      Object.keys(linkedListingSourceByListingId ?? {})
        .sort()
        .join("|"),
    [linkedListingSourceByListingId]
  );
  const povFreezeCreatedBefore = useSelector(selectPovFreezeCreatedBefore);
  const hiddenLayerIdsRaw = useSelector((s) => s.layers?.hiddenLayerIds);
  const showAnnotationsWithoutLayer = useSelector(
    (s) => s.layers?.showAnnotationsWithoutLayer ?? true
  );
  const hiddenLayerIdsKey = toKey(hiddenLayerIdsRaw);

  const { rows, hostById, listingById } = useMeshPaints();
  const hasRows = rows.length > 0;
  const givenTemplates = options?.annotationTemplates;
  const givenBaseMaps = options?.baseMaps;
  const ownTemplates = useAnnotationTemplates({
    skip: !hasRows || Boolean(givenTemplates),
  });
  const annotationTemplates = givenTemplates ?? ownTemplates;
  // by-id join: a part painted on an annotation of a DETAIL base map
  // resolves its frame like useAnnotationsV2 does. Not queried without a
  // painted part (or when given): `includeDetails` flips with the gate, so
  // the live query re-runs when the first paint lands.
  const { value: ownBaseMaps } = useBaseMaps(
    hasRows && !givenBaseMaps
      ? { includeDetails: true }
      : { filterByProjectId: null }
  );
  const baseMaps = givenBaseMaps ?? ownBaseMaps;

  // helpers - lookups

  const templateById = useMemo(
    () => getItemsByKey(annotationTemplates ?? [], "id"),
    [annotationTemplates]
  );

  const baseMapById = useMemo(
    () => getItemsByKey(baseMaps ?? [], "id"),
    [baseMaps]
  );

  const metricsByBaseMapId = useMemo(
    () => getMeshPaintMetricsByBaseMapId(baseMaps ?? []),
    [baseMaps]
  );

  // helpers - filters

  const filters = useMemo(() => {
    const extraBaseMapIds = fromKey(extraBaseMapIdsKey);
    let baseMapIds = null;
    if (filterByMainBaseMap)
      baseMapIds = [mainBaseMapId, ...extraBaseMapIds].filter(Boolean);
    else if (filterByBaseMapId)
      baseMapIds = [filterByBaseMapId, ...extraBaseMapIds].filter(Boolean);
    return {
      scopeId: filterBySelectedScope ? (selectedScopeId ?? null) : null,
      linkedListingIds: fromKey(linkedListingIdsKey),
      baseMapIds,
      excludeBaseMapIds: fromKey(excludeBaseMapIdsKey),
      excludeListingsIds: fromKey(excludeListingsIdsKey),
      excludeIsForBaseMapsListings: Boolean(excludeIsForBaseMapsListings),
      onlyIsForBaseMapsListings: Boolean(onlyIsForBaseMapsListings),
      keepHiddenTemplates: Boolean(keepHiddenTemplates),
      excludeProfileTemplates: Boolean(excludeProfileTemplates),
      disabledAnnotationTemplates: fromKey(disabledTemplatesKey),
      hiddenLayerIds: fromKey(hiddenLayerIdsKey),
      showAnnotationsWithoutLayer,
      disabledLayerIds: fromKey(disabledLayerIdsKey),
      povFreezeCreatedBefore,
      viewBox: viewBoxKey
        ? (() => {
            const [x, y, width, height] = viewBoxKey.split(",").map(Number);
            return { x, y, width, height };
          })()
        : null,
    };
  }, [
    filterByMainBaseMap,
    filterByBaseMapId,
    mainBaseMapId,
    extraBaseMapIdsKey,
    filterBySelectedScope,
    selectedScopeId,
    linkedListingIdsKey,
    excludeBaseMapIdsKey,
    excludeListingsIdsKey,
    excludeIsForBaseMapsListings,
    onlyIsForBaseMapsListings,
    keepHiddenTemplates,
    excludeProfileTemplates,
    disabledTemplatesKey,
    hiddenLayerIdsKey,
    showAnnotationsWithoutLayer,
    disabledLayerIdsKey,
    povFreezeCreatedBefore,
    viewBoxKey,
  ]);

  // main

  const result = useMemo(() => {
    if (!enabled || !rows?.length || !annotationTemplates) return EMPTY_RESULT;

    const parts = resolvePaintedParts({
      rows,
      hostById,
      templateById,
      listingById,
      metricsByBaseMapId,
      baseMapById,
      filters,
    });
    if (parts.length === 0) return EMPTY_RESULT;

    const { byTemplateId, countsByListingId, templateIds, listingIds } =
      aggregatePaintedPartsByTemplate(parts);
    const partsByTemplateId = {};
    Object.entries(byTemplateId).forEach(([templateId, stats]) => {
      partsByTemplateId[templateId] = stats.parts;
    });

    return {
      parts,
      qtiesByTemplateId: byTemplateId,
      partsByTemplateId,
      templateIds,
      listingIds,
      countsByListingId,
      signature: getSignature(parts),
    };
  }, [
    enabled,
    rows,
    hostById,
    listingById,
    annotationTemplates,
    templateById,
    metricsByBaseMapId,
    baseMapById,
    filters,
  ]);

  // Content-stable identity: useBaseMaps / useAnnotationTemplates re-emit on
  // unrelated writes — same parts, same quantities → same object.
  const stableRef = useRef(EMPTY_RESULT);
  return useMemo(() => {
    if (result.signature === stableRef.current.signature)
      return stableRef.current;
    stableRef.current = result;
    return result;
  }, [result]);
}

// ---------------------------------------------------------------------------

const EMPTY_RESULT = Object.freeze({
  parts: Object.freeze([]),
  qtiesByTemplateId: Object.freeze({}),
  partsByTemplateId: Object.freeze({}),
  templateIds: new Set(),
  listingIds: new Set(),
  countsByListingId: Object.freeze({}),
  signature: "",
});

function toKey(value) {
  if (!value) return "";
  return [...value].filter((v) => v != null).join("|");
}

function fromKey(key) {
  return key ? key.split("|") : [];
}

// Everything a consumer displays from a part (quantities, status chips,
// names, colors / labels through the template and host rows).
function getSignature(parts) {
  return parts
    .map((p) =>
      [
        p.id,
        p.status,
        p.isStale ? 1 : 0,
        p.qtiesEnabled ? 1 : 0,
        p.surface,
        p.length,
        p.annotationTemplateId,
        p.listingId,
        p.listingName,
        p.baseMapId,
        p.baseMapName,
        p.layerId,
        p.hostAnnotationId,
        p.row?.updatedAt,
        p.row?.sync?.syncedAt,
        p.host?.updatedAt,
        p.template?.updatedAt,
        p.template?.label,
        p.template?.fillColor,
        p.template?.strokeColor,
        p.template?.hidden ? 1 : 0,
      ].join("~")
    )
    .join("\n");
}
