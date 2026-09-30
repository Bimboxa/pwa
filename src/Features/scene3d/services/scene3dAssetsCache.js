import {
  CompressedTexture,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  RGB_S3TC_DXT1_Format,
  SRGBColorSpace,
  Texture,
  UnsignedByteType,
} from "three";

import db from "App/db/db";

import buildScene3dChunkGeometry from "../js/buildScene3dChunkGeometry";
import decodeBc1 from "../utils/decodeBc1";
import { parseScene3dAssetId } from "../utils/scene3dAssetIds";

// GPU resources of the SCENE_3D annotations (geometries + textures), shared
// by every 3D object showing the same scan and kept across rebuilds.
//
// Why a cache: a render-mode change (or any edit of the annotation row)
// rebuilds the annotation objects — ThreedEditor.loadAnnotations disposes the
// old object BEFORE creating the new one. Entries are ref-counted and their
// eviction is delayed, so the rebuild finds the scan still on the GPU instead
// of reading it again from IndexedDB.
//
// Memory: the scan is loaded ATLAS BY ATLAS (one texture row + its geometry
// rows at a time) and every CPU copy is dropped once uploaded — the steady
// state holds (almost) nothing in RAM.

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
      geometries: geometryRows
        .filter(Boolean)
        .map((row) =>
          buildScene3dChunkGeometry(row, { releaseAfterUpload: true })
        ),
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
// supportsBc1: the renderer has the S3TC (+ sRGB) extensions.
export function acquireScene3dAssets(sceneId, { supportsBc1, onEvent }) {
  let entry = entries.get(sceneId);
  if (!entry) {
    entry = {
      sceneId,
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

// --- top view texture (3D "projection" mode): same ref-count + delayed
// eviction, keyed by the db.files fileName.

const topViewEntries = new Map();

async function loadTopViewTexture(fileName) {
  const record = await db.files.get(fileName);
  if (!record?.fileArrayBuffer) return null;
  const blob = new Blob([record.fileArrayBuffer], { type: record.fileMime });
  // Flipped at decode time: three.js ignores `flipY` for an ImageBitmap, and
  // the plane uvs expect the image bottom on the first row.
  const bitmap = await createImageBitmap(blob, { imageOrientation: "flipY" });
  const texture = new Texture(bitmap);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = ANISOTROPY;
  texture.needsUpdate = true;
  texture.onUpdate = () => {
    bitmap.close();
    texture.onUpdate = null;
  };
  return texture;
}

// → {promise: Promise<Texture | null>, release}
export function acquireScene3dTopViewTexture(fileName) {
  let entry = topViewEntries.get(fileName);
  if (!entry) {
    entry = { refCount: 0, evictTimer: null, promise: null };
    entry.promise = loadTopViewTexture(fileName).catch((error) => {
      console.error("[scene3dAssetsCache] top view load failed", error);
      return null;
    });
    topViewEntries.set(fileName, entry);
  }
  clearTimeout(entry.evictTimer);
  entry.refCount += 1;

  let released = false;
  return {
    promise: entry.promise,
    release() {
      if (released) return;
      released = true;
      entry.refCount -= 1;
      if (entry.refCount > 0) return;
      entry.evictTimer = setTimeout(() => {
        if (entry.refCount > 0) return;
        if (topViewEntries.get(fileName) === entry) {
          topViewEntries.delete(fileName);
        }
        entry.promise.then((texture) => texture?.dispose());
      }, EVICTION_DELAY_MS);
    },
  };
}

export function evictScene3dTopViewTexture(fileName) {
  const entry = topViewEntries.get(fileName);
  if (!entry) return;
  clearTimeout(entry.evictTimer);
  topViewEntries.delete(fileName);
  entry.promise.then((texture) => texture?.dispose());
}
