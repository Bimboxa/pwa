import {
  CompressedTexture,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  RGB_S3TC_DXT1_Format,
  SRGBColorSpace,
  UnsignedByteType,
} from "three";

import db from "App/db/db";

import buildScene3dChunkGeometry from "../js/buildScene3dChunkGeometry";
import decodeBc1 from "../utils/decodeBc1";
import { parseScene3dAssetId } from "../utils/scene3dAssetIds";

// GPU resources of the scan base maps (geometries + textures), shared
// by every 3D object showing the same scan and kept across rebuilds.
//
// Why a cache: a base map reload (main base map switch, display toggle)
// rebuilds the base map groups — the old scan wrap is disposed BEFORE the
// new one is attached. Entries are ref-counted and their eviction is
// delayed, so the rebuild finds the scan still on the GPU instead of reading
// it again from IndexedDB.
//
// Memory: the scan is loaded ATLAS BY ATLAS (one texture row + its geometry
// rows at a time) and every CPU copy is dropped once uploaded — the steady
// state holds (almost) nothing in RAM.
//
// Consequence: an entry is bound to the WebGL renderer it was uploaded to.
// A CPU-less geometry can never be uploaded again — a new renderer (the 3D
// editor remounts: 2D/3D toggle, module switch) or a geometry.dispose()
// from a generic scene teardown would crash three.js on the next render
// ("Cannot read properties of null (reading 'byteLength')"). Entries are
// therefore keyed by renderer (a mismatch evicts and reloads from IndexedDB)
// and self-evict as soon as one of their geometries is disposed.

const EVICTION_DELAY_MS = 15000;
// Fallback without S3TC: the BC1 data is decoded to RGBA from this mip level
// (half size — RGBA costs 8x more GPU memory than BC1).
const FALLBACK_MIP_LEVEL = 1;
const ANISOTROPY = 4;

const entries = new Map();

function createBc1Texture(row) {
  const texture = new CompressedTexture(
    row.mipmaps,
    row.width,
    row.height,
    RGB_S3TC_DXT1_Format,
    UnsignedByteType
  );
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = ANISOTROPY;
  texture.needsUpdate = true;
  // drop the CPU copy once on the GPU
  texture.onUpdate = () => {
    texture.mipmaps = texture.mipmaps.map((mipmap) => ({
      width: mipmap.width,
      height: mipmap.height,
      data: null,
    }));
    texture.onUpdate = null;
  };
  return texture;
}

function createRgbaTexture(row) {
  const level = Math.min(FALLBACK_MIP_LEVEL, row.mipmaps.length - 1);
  const mipmap = row.mipmaps[level];
  const rgba = decodeBc1(mipmap.data, mipmap.width, mipmap.height);
  const texture = new DataTexture(
    rgba,
    mipmap.width,
    mipmap.height,
    RGBAFormat,
    UnsignedByteType
  );
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = ANISOTROPY;
  texture.needsUpdate = true;
  return texture;
}

function disposeAtlas(atlas) {
  atlas.texture?.dispose();
  atlas.geometries.forEach((geometry) => geometry.dispose());
}

function notify(entry, event) {
  entry.listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.error("[scene3dAssetsCache] listener threw", error);
    }
  });
}

async function loadEntry(entry, supportsBc1) {
  const keys = await db.scene3dAssets
    .where("sceneId")
    .equals(entry.sceneId)
    .primaryKeys();
  if (entry.disposed) return;

  const byAtlas = new Map();
  for (const key of keys) {
    const parsed = parseScene3dAssetId(key);
    // the height map row (2D altimetry) belongs to no atlas
    if (!parsed || parsed.kind === "HEIGHT") continue;
    const atlas = byAtlas.get(parsed.atlasIndex) ?? {
      textureKey: null,
      geometryKeys: [],
    };
    if (parsed.kind === "TEXTURE") atlas.textureKey = key;
    else atlas.geometryKeys.push(key);
    byAtlas.set(parsed.atlasIndex, atlas);
  }

  const atlasIndexes = [...byAtlas.keys()]
    .filter((index) => byAtlas.get(index).geometryKeys.length > 0)
    .sort((a, b) => a - b);
  if (atlasIndexes.length === 0) {
    entry.status = "MISSING";
    notify(entry, { type: "MISSING" });
    return;
  }

  for (const atlasIndex of atlasIndexes) {
    const { textureKey, geometryKeys } = byAtlas.get(atlasIndex);
    const [textureRow, geometryRows] = await Promise.all([
      textureKey ? db.scene3dAssets.get(textureKey) : null,
      db.scene3dAssets.bulkGet(geometryKeys),
    ]);
    const atlas = {
      atlasIndex,
      texture: textureRow
        ? supportsBc1
          ? createBc1Texture(textureRow)
          : createRgbaTexture(textureRow)
        : null,
      geometries: geometryRows.filter(Boolean).map((row) => {
        const geometry = buildScene3dChunkGeometry(row, {
          releaseAfterUpload: true,
        });
        // Disposed from outside (scene teardown…): the GPU copy is gone and
        // the CPU one was released — the whole entry must reload.
        geometry.addEventListener("dispose", () => {
          if (!entry.disposed) disposeEntry(entry);
        });
        return geometry;
      }),
    };
    if (entry.disposed) {
      disposeAtlas(atlas);
      return;
    }
    entry.atlases.push(atlas);
    notify(entry, { type: "ATLAS", atlas });
  }
  entry.status = "READY";
  notify(entry, { type: "READY" });
}

function disposeEntry(entry) {
  entry.disposed = true;
  clearTimeout(entry.evictTimer);
  entry.atlases.forEach(disposeAtlas);
  entry.atlases = [];
  entry.listeners.clear();
  if (entries.get(entry.sceneId) === entry) entries.delete(entry.sceneId);
}

// Takes a reference on the GPU resources of a scan (loading starts on the
// first call). `onEvent` receives, in order:
//   {type: "ATLAS", atlas: {atlasIndex, texture | null, geometries}} — once
//     per atlas, already-loaded atlases are replayed immediately;
//   {type: "READY"} when every atlas is there;
//   {type: "MISSING"} when the scan data is not on this device.
// Returns the release function (call it exactly once).
// renderer: the WebGLRenderer the resources are uploaded to (see the header:
//   an entry uploaded to another renderer is evicted and reloaded).
// supportsBc1: the renderer has the S3TC (+ sRGB) extensions.
export function acquireScene3dAssets(
  sceneId,
  { renderer = null, supportsBc1, onEvent }
) {
  let entry = entries.get(sceneId);
  if (entry && entry.renderer !== renderer) {
    disposeEntry(entry);
    entry = null;
  }
  if (!entry) {
    entry = {
      sceneId,
      renderer,
      refCount: 0,
      evictTimer: null,
      status: "LOADING",
      atlases: [],
      listeners: new Set(),
      disposed: false,
    };
    entries.set(sceneId, entry);
    loadEntry(entry, supportsBc1).catch((error) => {
      console.error("[scene3dAssetsCache] load failed", error);
      if (entry.disposed) return;
      entry.status = "MISSING";
      notify(entry, { type: "MISSING" });
    });
  }
  clearTimeout(entry.evictTimer);
  entry.refCount += 1;

  if (onEvent) {
    entry.atlases.forEach((atlas) => onEvent({ type: "ATLAS", atlas }));
    if (entry.status !== "LOADING") onEvent({ type: entry.status });
    entry.listeners.add(onEvent);
  }

  let released = false;
  return function release() {
    if (released) return;
    released = true;
    if (onEvent) entry.listeners.delete(onEvent);
    if (entry.disposed) return;
    entry.refCount -= 1;
    if (entry.refCount > 0) return;
    entry.evictTimer = setTimeout(() => {
      if (entry.refCount <= 0) disposeEntry(entry);
    }, EVICTION_DELAY_MS);
  };
}

// Immediate eviction (the scan data was deleted / replaced).
export function evictScene3dAssets(sceneId) {
  const entry = entries.get(sceneId);
  if (entry) disposeEntry(entry);
}
