import db from "App/db/db";

import createScene3dImportWorker from "./createScene3dImportWorker";
import {
  getScene3dHeightId,
  parseScene3dAssetId,
} from "../utils/scene3dAssetIds";

// Height maps of the SCENE_3D scans (see rasterizeScene3dHeightMap): what
// gives the 2D editor the altitude of the scan under the cursor.
//
// Nominal path: the map was rasterized at import and sits in
// db.scene3dAssets (HEIGHT row) — one read, ready in a few ms. Fallback for a
// scan imported before the height maps existed: rebuilt once from its
// GEOMETRY rows in the import worker, then stored for the next time. No
// scan data on this device (Krto received elsewhere): MISSING.
//
// Kept for the life of the page (≤ 8 MB per scan, no eviction). Same status
// summary contract as scene3dPickStore (for the UI).

const entries = new Map();

const listeners = new Set();
let summary = null;

function computeSummary() {
  const all = [...entries.values()];
  if (all.length === 0) return null;
  const loading = all.filter((entry) => entry.status === "LOADING");
  if (loading.length > 0) {
    return {
      status: "LOADING",
      done: all.reduce((sum, entry) => sum + entry.done, 0),
      total: all.reduce((sum, entry) => sum + entry.total, 0),
    };
  }
  if (all.some((entry) => entry.status === "READY")) return { status: "READY" };
  const failed = all.find((entry) => entry.status === "ERROR");
  if (failed) return { status: "ERROR", error: failed.error };
  return { status: "MISSING" };
}

function notifyStatus() {
  summary = computeSummary();
  listeners.forEach((listener) => listener());
}

export function subscribeScene3dHeightMapStatus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// → null (no scan involved) | {status: "LOADING", done, total} |
//   {status: "READY"} | {status: "MISSING"} | {status: "ERROR", error}
export function getScene3dHeightMapStatus() {
  return summary;
}

async function* readGeometryRows(keys, entry) {
  for (const key of keys) {
    const row = await db.scene3dAssets.get(key);
    if (row) yield row;
    entry.done += 1;
    notifyStatus();
  }
}

async function rebuildHeightMap(entry, bbox, geometryKeys) {
  entry.total = geometryKeys.length;
  notifyStatus();
  const worker = createScene3dImportWorker();
  try {
    const heightMap = await worker.buildHeightMap(
      bbox,
      readGeometryRows(geometryKeys, entry)
    );
    if (!heightMap) throw new Error("Height map rebuild returned nothing.");
    await db.scene3dAssets.put({
      id: getScene3dHeightId(entry.sceneId),
      sceneId: entry.sceneId,
      projectId: entry.projectId ?? null,
      kind: "HEIGHT",
      ...heightMap,
    });
    return heightMap;
  } finally {
    worker.terminate();
  }
}

async function loadEntry(entry, bbox) {
  const stored = await db.scene3dAssets.get(getScene3dHeightId(entry.sceneId));
  if (stored?.data) {
    entry.heightMap = stored;
    entry.status = "READY";
    notifyStatus();
    return;
  }

  const keys = await db.scene3dAssets
    .where("sceneId")
    .equals(entry.sceneId)
    .primaryKeys();
  const geometryKeys = keys.filter(
    (key) => parseScene3dAssetId(key)?.kind === "GEOMETRY"
  );
  if (geometryKeys.length === 0 || !bbox?.min || !bbox?.max) {
    entry.status = "MISSING";
    notifyStatus();
    return;
  }
  const startedAt = Date.now();
  entry.heightMap = await rebuildHeightMap(entry, bbox, geometryKeys);
  entry.status = "READY";
  console.log(
    `[scene3dHeightMapStore] scan ${entry.sceneId}: height map rebuilt in ${Date.now() - startedAt} ms`
  );
  notifyStatus();
}

// Makes the height map of a scan available (no-op when already there).
// `bbox` (annotation.scene3d.bbox) is only needed for the rebuild fallback.
// → "LOADING" | "READY" | "MISSING" | "ERROR"
export function ensureScene3dHeightMap(sceneId, { bbox, projectId } = {}) {
  if (!sceneId) return "MISSING";
  let entry = entries.get(sceneId);
  if (!entry) {
    entry = {
      sceneId,
      projectId: projectId ?? null,
      status: "LOADING",
      done: 0,
      total: 0,
      error: null,
      heightMap: null,
    };
    entries.set(sceneId, entry);
    notifyStatus();
    loadEntry(entry, bbox).catch((error) => {
      console.error("[scene3dHeightMapStore] load failed", error);
      entry.status = "ERROR";
      entry.error = error?.message ?? String(error);
      notifyStatus();
    });
  }
  return entry.status;
}

// Height map of a scan, or null while it is not ready.
export function getScene3dHeightMap(sceneId) {
  const entry = entries.get(sceneId);
  return entry?.status === "READY" ? entry.heightMap : null;
}

// Status of one scan ("LOADING" | "READY" | "MISSING" | "ERROR") or null
// when nothing was asked for it yet.
export function getScene3dHeightMapEntryStatus(sceneId) {
  return entries.get(sceneId)?.status ?? null;
}

export function evictScene3dHeightMap(sceneId) {
  if (entries.delete(sceneId)) notifyStatus();
}
