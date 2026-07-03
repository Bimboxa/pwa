import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import {
  NO_LAYER_ID,
  NO_TEMPLATE_KEY_PREFIX,
  getAnnotationTemplateKey,
  getAnnotationLayerKey,
} from "../services/duplicateScopeService";

const notDeleted = (r) => r && !r.deletedAt;

// Everything the duplicate-scope dialog needs to render its filter sections:
// annotation-bearing baseMaps / layers / listings / templates of the source
// scope, with annotation counts. Mirrors the read+filter semantics of
// duplicateScopeService so the counts match what would be copied.
export default function useDuplicateScopeSourceData(scope) {
  const scopeId = scope?.id;
  const projectId = scope?.projectId;

  const value = useLiveQuery(async () => {
    if (!scopeId) return null;

    const listings = (
      await db.listings.where("scopeId").equals(scopeId).toArray()
    ).filter(notDeleted);
    const listingIds = listings.map((l) => l.id);

    const [annotations, templates, layers, projectBaseMaps] = await Promise.all(
      [
        listingIds.length > 0
          ? db.annotations
              .where("listingId")
              .anyOf(listingIds)
              .toArray()
              .then((rows) => rows.filter(notDeleted))
          : [],
        listingIds.length > 0
          ? db.annotationTemplates
              .where("listingId")
              .anyOf(listingIds)
              .toArray()
              .then((rows) => rows.filter(notDeleted))
          : [],
        db.layers
          .where("scopeId")
          .equals(scopeId)
          .toArray()
          .then((rows) => rows.filter(notDeleted)),
        projectId
          ? db.baseMaps
              .where("projectId")
              .equals(projectId)
              .toArray()
              .then((rows) => rows.filter(notDeleted))
          : [],
      ]
    );

    const liveLayerIds = new Set(layers.map((l) => l.id));

    // counts

    const countByBaseMapId = {};
    const countByLayerKey = {};
    const countByTemplateKey = {};
    let hasAnnotationsWithoutLayer = false;

    annotations.forEach((a) => {
      countByBaseMapId[a.baseMapId] = (countByBaseMapId[a.baseMapId] ?? 0) + 1;

      const layerKey = getAnnotationLayerKey(a, liveLayerIds);
      if (layerKey === NO_LAYER_ID) hasAnnotationsWithoutLayer = true;
      countByLayerKey[layerKey] = (countByLayerKey[layerKey] ?? 0) + 1;

      const templateKey = getAnnotationTemplateKey(a);
      countByTemplateKey[templateKey] =
        (countByTemplateKey[templateKey] ?? 0) + 1;
    });

    // presence filtering: only annotation-bearing items are offered

    const baseMaps = projectBaseMaps
      .filter((b) => countByBaseMapId[b.id] > 0)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    const presentLayers = layers
      .filter((l) => countByLayerKey[l.id] > 0)
      .sort((a, b) =>
        String(a.orderIndex ?? "").localeCompare(String(b.orderIndex ?? ""))
      );

    const templatesByListingId = {};
    templates.forEach((t) => {
      if (countByTemplateKey[t.id] > 0) {
        if (!templatesByListingId[t.listingId])
          templatesByListingId[t.listingId] = [];
        templatesByListingId[t.listingId].push(t);
      }
    });

    const presentListings = listings.filter(
      (l) =>
        templatesByListingId[l.id]?.length > 0 ||
        countByTemplateKey[NO_TEMPLATE_KEY_PREFIX + l.id] > 0
    );

    return {
      annotationsCount: annotations.length,
      baseMaps,
      layers: presentLayers,
      hasRealLayers: layers.length > 0,
      listings: presentListings,
      templatesByListingId,
      countByBaseMapId,
      countByLayerKey,
      countByTemplateKey,
      hasAnnotationsWithoutLayer,
    };
  }, [scopeId, projectId]);

  return { value: value ?? null, loading: value === undefined };
}
