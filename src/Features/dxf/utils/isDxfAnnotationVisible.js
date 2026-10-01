// Only suppress this import's annotations when its raster reference is
// active. User-created annotations and other listings remain visible.
export default function isDxfAnnotationVisible(annotation, baseMap) {
  if (!annotation.fromDXF || annotation.listingId !== baseMap?.dxf?.listingId)
    return true;
  const active =
    baseMap.getActiveVersion?.() ??
    baseMap.versions?.find((version) => version.isActive && !version.deletedAt);
  return active?.id !== baseMap.dxf.referenceVersionId;
}
