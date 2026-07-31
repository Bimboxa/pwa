// Reference-frame image size of a base map, read from the RAW Dexie records —
// no image hydration, so services can resolve it without building a BaseMap
// instance.
//
// Mirrors `BaseMap.getImageSize()` (Features/baseMaps/js/BaseMap.js:294): a
// versioned base map reports its REFERENCE dimensions (refWidth/refHeight), not
// the active version's pixel size, because annotation points are normalized
// against that reference frame. Keep the two in sync.
export default function getBaseMapImageSizeFromRecord(record, versions = []) {
  if (!record) return null;
  const liveVersions = (versions || []).filter((v) => !v?.deletedAt);
  if (liveVersions.length > 0 && record.refWidth && record.refHeight) {
    return { width: record.refWidth, height: record.refHeight };
  }
  const imageToUse =
    record.showEnhanced && record.imageEnhanced
      ? record.imageEnhanced
      : record.image;
  return imageToUse?.imageSize ?? null;
}
