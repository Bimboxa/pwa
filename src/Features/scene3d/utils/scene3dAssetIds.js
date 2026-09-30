// Primary keys of db.scene3dAssets. The key alone tells the scene, the kind
// and the atlas, so the rows of one atlas are read with a key-range query
// (never by loading the whole scene).

const pad = (value, length) => String(value).padStart(length, "0");

export function getScene3dGeometryId(sceneId, atlasIndex, chunkIndex) {
  return `${sceneId}/g/${pad(atlasIndex, 4)}/${pad(chunkIndex, 5)}`;
}

export function getScene3dTextureId(sceneId, atlasIndex) {
  return `${sceneId}/t/${pad(atlasIndex, 4)}`;
}

// [lower, upper] bounds of the geometry keys of one atlas.
export function getScene3dGeometryIdRange(sceneId, atlasIndex) {
  const prefix = `${sceneId}/g/${pad(atlasIndex, 4)}/`;
  return [prefix, `${prefix}￿`];
}

// → {kind: "GEOMETRY" | "TEXTURE", atlasIndex} | null
export function parseScene3dAssetId(id) {
  const parts = String(id).split("/");
  if (parts.length < 3) return null;
  const kind =
    parts[1] === "g" ? "GEOMETRY" : parts[1] === "t" ? "TEXTURE" : null;
  if (!kind) return null;
  return { kind, atlasIndex: Number(parts[2]) };
}
