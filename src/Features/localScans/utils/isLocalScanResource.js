// A project resource holding a point cloud of the Scan 3D tool (PLY saved
// by scanResources / createScanResourceStore).
export default function isLocalScanResource(resource) {
  return Boolean(
    resource &&
    !resource.deletedAt &&
    (resource.kind === "LOCAL_SCAN_3D" || resource.fileType === "PLY")
  );
}
