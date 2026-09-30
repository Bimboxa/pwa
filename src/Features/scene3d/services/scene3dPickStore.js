import { BufferAttribute, BufferGeometry, DoubleSide } from "three";
import { MeshBVH } from "three-mesh-bvh";

import db from "App/db/db";

import { parseScene3dAssetId } from "../utils/scene3dAssetIds";

// Picking data of the SCENE_3D scans: what lets a drawing tool land a point
// ON the scan mesh.
//
// The displayed scan has no CPU geometry (dropped after the GPU upload, see
// scene3dAssetsCache) and its meshes never answer a raycast. Picking works
// on a separate, CPU-only copy: per chunk, the positions + index read back
// from db.scene3dAssets and a BVH (three-mesh-bvh) over them. A pick is then
// ~0.02 ms whatever the scan size (brute force would test every triangle on
// each pointer move).
//
// ON DEMAND ONLY: the data is built the first time a drawing tool asks for
// it (~1 s for 2.8 M triangles, chunk by chunk without freezing the UI) and
// dropped once unused — displaying a scan costs no RAM, drawing on it costs
// positions + index + BVH (~60 MB for 2.8 M triangles) while it lasts.
//
// Everything here lives in the chunk space: the normalized [0..1]³ grid the
// positions are quantized on (the caller owns the ray ↔ world transform).

// Dropped when no pick was asked for this long.
const IDLE_EVICTION_MS = 60000;
const IDLE_CHECK_MS = 15000;

const entries = new Map();

// --- status, for the UI (useScene3dPickingStatus): one summary of every
// scan being prepared / ready, replaced (new reference) on each change.

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

export function subscribeScene3dPickStatus(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// → null (no scan involved) | {status: "LOADING", done, total} |
//   {status: "READY"} | {status: "MISSING"} | {status: "ERROR", error}
export function getScene3dPickStatus() {
  return summary;
}

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

function disposeEntry(entry) {
  entry.disposed = true;
  clearInterval(entry.idleTimer);
  entry.bvhs = [];
  if (entries.get(entry.sceneId) === entry) entries.delete(entry.sceneId);
  notifyStatus();
}

async function loadEntry(entry) {
  const keys = await db.scene3dAssets
    .where("sceneId")
    .equals(entry.sceneId)
    .primaryKeys();
  const geometryKeys = keys.filter(
    (key) => parseScene3dAssetId(key)?.kind === "GEOMETRY"
  );
  if (geometryKeys.length === 0) {
    entry.status = "MISSING";
    notifyStatus();
    return;
  }
  entry.total = geometryKeys.length;
  notifyStatus();
  const startedAt = Date.now();

  for (const key of geometryKeys) {
    if (entry.disposed) return;
    const row = await db.scene3dAssets.get(key);
    if (!row || entry.disposed) continue;
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(row.positions, 3, true)
    );
    // The BVH reorders the index in place: this copy is the pick data's own.
    geometry.setIndex(new BufferAttribute(row.index, 1));
    entry.bvhs.push(new MeshBVH(geometry));
    entry.done += 1;
    notifyStatus();
    // one chunk (~20 ms) per task: the UI stays responsive
    await nextTick();
  }
  if (entry.disposed) return;
  entry.status = "READY";
  entry.lastUsed = Date.now();
  console.log(
    `[scene3dPickStore] scan ${entry.sceneId} ready for picking: ${entry.bvhs.length} chunks in ${Date.now() - startedAt} ms`
  );
  notifyStatus();
  entry.idleTimer = setInterval(() => {
    if (Date.now() - entry.lastUsed > IDLE_EVICTION_MS) disposeEntry(entry);
  }, IDLE_CHECK_MS);
}

// Starts building the picking data of a scan (no-op when already there).
// → "LOADING" | "READY" | "MISSING" (no scan data on this device) | "ERROR"
export function ensureScene3dPickData(sceneId) {
  let entry = entries.get(sceneId);
  if (!entry) {
    entry = {
      sceneId,
      status: "LOADING",
      done: 0,
      total: 0,
      error: null,
      bvhs: [],
      lastUsed: Date.now(),
      idleTimer: null,
      disposed: false,
    };
    entries.set(sceneId, entry);
    notifyStatus();
    loadEntry(entry).catch((error) => {
      console.error("[scene3dPickStore] load failed", error);
      if (entry.disposed) return;
      entry.status = "ERROR";
      entry.error = error?.message ?? String(error);
      notifyStatus();
    });
  }
  return entry.status;
}

// Hits of a ray on a scan, in the chunk space ([{point, distance, face}],
// see MeshBVH.raycast), or null while the picking data is not ready.
//   firstOnly (default): at most one hit, the nearest;
//   else every hit, unsorted (the caller filters — e.g. a clipping plane).
export function raycastScene3dPickData(
  sceneId,
  ray,
  { firstOnly = true } = {}
) {
  const entry = entries.get(sceneId);
  if (!entry || entry.status !== "READY") return null;
  entry.lastUsed = Date.now();

  if (!firstOnly) {
    return entry.bvhs.flatMap((bvh) => bvh.raycast(ray, DoubleSide));
  }
  let best = null;
  for (const bvh of entry.bvhs) {
    const hit = bvh.raycastFirst(ray, DoubleSide);
    if (hit && (!best || hit.distance < best.distance)) best = hit;
  }
  return best ? [best] : [];
}

export function evictScene3dPickData(sceneId) {
  const entry = entries.get(sceneId);
  if (entry) disposeEntry(entry);
}
