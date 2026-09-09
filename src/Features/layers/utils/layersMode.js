import db from "App/db/db";

// Table of the layers rows for a layers mode (scopeConfigs.layersMode):
// db.layers (per base map) or db.globalLayers (per scope).
export function getLayersTable(mode) {
  return mode === "GLOBAL" ? db.globalLayers : db.layers;
}

// Layer row by id whatever the table (a stale layerId may point at the
// other mode's table).
export async function getLayerByIdAsync(layerId) {
  if (!layerId) return null;
  const layer = await db.layers.get(layerId);
  if (layer && !layer.deletedAt) return { ...layer, isGlobal: false };
  const global = await db.globalLayers.get(layerId);
  if (global && !global.deletedAt) return { ...global, isGlobal: true };
  return null;
}

const byOrderIndex = (a, b) => {
  if (a.orderIndex != null && b.orderIndex != null) {
    return a.orderIndex < b.orderIndex
      ? -1
      : a.orderIndex > b.orderIndex
        ? 1
        : 0;
  }
  if (a.orderIndex != null) return -1;
  if (b.orderIndex != null) return 1;
  return 0;
};

// Live layers list of a base map in a mode (async, for liveQuery callers
// like useAnnotationsV2's z-order block): GLOBAL → the scope's global
// layers, BASE_MAP → the base map's layers.
export async function getLayersAsync({ mode, baseMapId, scopeId }) {
  let rows;
  if (mode === "GLOBAL") {
    if (!scopeId) return [];
    rows = await db.globalLayers.where("scopeId").equals(scopeId).toArray();
  } else {
    if (!baseMapId) return [];
    rows = await db.layers.where("baseMapId").equals(baseMapId).toArray();
    if (scopeId) rows = rows.filter((r) => r.scopeId === scopeId);
  }
  return rows.filter((r) => !r.deletedAt).sort(byOrderIndex);
}

// Annotations carrying a layer, whatever the mode: BASE_MAP → the layer's
// base map, GLOBAL → the whole project (a global layer spans base maps).
export async function getLayerAnnotationsAsync(layer) {
  if (!layer?.id) return [];
  const rows = layer.baseMapId
    ? await db.annotations.where("baseMapId").equals(layer.baseMapId).toArray()
    : layer.projectId
      ? await db.annotations
          .where("projectId")
          .equals(layer.projectId)
          .toArray()
      : [];
  return rows.filter((a) => !a.deletedAt && a.layerId === layer.id);
}
