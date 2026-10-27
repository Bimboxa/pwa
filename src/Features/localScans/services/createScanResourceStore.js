// Keep large local PLYs as Blobs: no extra full-file ArrayBuffer allocation.
// Resource metadata follows normal project ownership/export rules; the file has
// no listingId and is excluded from the existing scope-file export filter.
export default function createScanResourceStore(db, newId) {
  return {
    async list(projectId) {
      return (
        await db.resources.where("projectId").equals(projectId).toArray()
      ).filter(
        (row) =>
          !row.deletedAt &&
          (row.kind === "LOCAL_SCAN_3D" || row.fileType === "PLY")
      );
    },
    get(resourceId) {
      return db.resources.get(resourceId);
    },
    async source(resource) {
      const row = await db.files.get(resource.fileName);
      const payload = row?.fileBlob ?? row?.fileArrayBuffer;
      return payload
        ? new File([payload], resource.name, {
            type: row.fileMime || "application/octet-stream",
          })
        : null;
    },
    async save({ projectId, file, data, placement, zone, legacyKey, signal }) {
      const id = newId(),
        fileName = `resource_${id}_${file.name}`;
      const resource = {
        id,
        projectId,
        name: file.name,
        fileName,
        fileSize: file.size,
        fileMime: file.type || "application/octet-stream",
        fileType: "PLY",
        kind: "LOCAL_SCAN_3D",
        visibility: "PROJECT",
        scopeId: null,
        scan: {
          count: data.count,
          kind: data.kind,
          bounds: data.bounds,
          placement,
          ...(zone && { zone }),
        },
        ...(legacyKey && { legacyScanKey: legacyKey }),
      };
      await db.transaction("rw", db.resources, db.files, async () => {
        if (signal?.aborted)
          throw new DOMException("Import cancelled", "AbortError");
        await db.files.add({
          fileName,
          fileBlob: file,
          projectId,
          fileMime: resource.fileMime,
          srcFileName: file.name,
          fileType: "PLY",
        });
        await db.resources.add(resource);
        if (signal?.aborted)
          throw new DOMException("Import cancelled", "AbortError");
      });
      return resource;
    },
    // Merges `patch` into the resource's scan metadata (placement, display,
    // zone); the source file is never rewritten.
    async update(resourceId, patch) {
      await db.transaction("rw", db.resources, async () => {
        const row = await db.resources.get(resourceId);
        if (!row || row.deletedAt)
          throw new Error("La ressource du scan n’est plus disponible.");
        await db.resources.update(resourceId, {
          scan: { ...row.scan, ...patch },
        });
      });
    },
    place(resourceId, placement) {
      return this.update(resourceId, { placement });
    },
  };
}
