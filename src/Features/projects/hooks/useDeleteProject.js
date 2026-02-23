import db, { withHardDelete } from "App/db/db";

export default function useDeleteProject() {
  const deleteProjects = async (projectId) => {
    // 1. Collect all IDs before deleting anything
    const listings = await db.listings
      .where("projectId")
      .equals(projectId)
      .toArray();
    const listingIds = listings.map((l) => l.id);

    let mapIds = [];
    if (listingIds.length > 0) {
      const maps = await db.maps
        .where("listingId")
        .anyOf(listingIds)
        .toArray();
      mapIds = maps.map((m) => m.id);
    }

    const baseMaps = await db.baseMaps
      .where("projectId")
      .equals(projectId)
      .toArray();
    const baseMapIds = baseMaps.map((b) => b.id);

    const scopes = await db.scopes
      .where("projectId")
      .equals(projectId)
      .toArray();
    const scopeIds = scopes.map((s) => s.id);

    // 2. Hard delete everything in cascade
    await withHardDelete(async () => {
      await db.projects.delete(projectId);
      await db.scopes.where("projectId").equals(projectId).delete();
      await db.baseMaps.where("projectId").equals(projectId).delete();
      await db.blueprints.where("projectId").equals(projectId).delete();
      await db.listings.where("projectId").equals(projectId).delete();
      await db.annotationTemplates
        .where("projectId")
        .equals(projectId)
        .delete();
      await db.annotations.where("projectId").equals(projectId).delete();

      if (listingIds.length > 0) {
        await db.entities.where("listingId").anyOf(listingIds).delete();
        await db.maps.where("listingId").anyOf(listingIds).delete();
        await db.files.where("listingId").anyOf(listingIds).delete();
        await db.zonings.where("listingId").anyOf(listingIds).delete();
        await db.relsZoneEntity.where("listingId").anyOf(listingIds).delete();
        await db.entitiesProps.where("listingId").anyOf(listingIds).delete();
        await db.legends.where("listingId").anyOf(listingIds).delete();
        await db.relationsEntities
          .where("listingId")
          .anyOf(listingIds)
          .delete();
        await db.reports.where("listingId").anyOf(listingIds).delete();
      }

      if (mapIds.length > 0) {
        await db.markers.where("mapId").anyOf(mapIds).delete();
      }

      if (baseMapIds.length > 0) {
        await db.baseMapViews.where("baseMapId").anyOf(baseMapIds).delete();
      }

      if (scopeIds.length > 0) {
        await db.syncFiles.where("scopeId").anyOf(scopeIds).delete();
      }
    });

    console.log(
      `Project ${projectId} and all related data deleted successfully`
    );
  };

  return deleteProjects;
}
