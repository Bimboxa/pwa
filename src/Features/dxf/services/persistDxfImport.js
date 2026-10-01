// Keep image decoding, rendering and all other non-IndexedDB work outside
// this transaction. A failed import must leave no partial map or listing.
export default async function persistDxfImport(
  db,
  { baseMap, listing, versions, files, layers, points, annotations, layersMode }
) {
  const layerTable = layersMode === "GLOBAL" ? db.globalLayers : db.layers;
  await db.transaction(
    "rw",
    [
      db.baseMaps,
      db.baseMapVersions,
      db.listings,
      db.files,
      layerTable,
      db.points,
      db.annotations,
    ],
    async () => {
      await db.listings.add(listing);
      await db.files.bulkAdd(files);
      await db.baseMaps.add(baseMap);
      await db.baseMapVersions.bulkAdd(versions);
      if (layers.length) await layerTable.bulkAdd(layers);
      if (points.length) await db.points.bulkAdd(points);
      await db.annotations.bulkAdd(annotations);
    }
  );
}
