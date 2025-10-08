import db from "App/db/db";

export default function useDeleteProject() {
  const deleteProjects = async (projectId) => {
    // Delete project and all related data
    await db.projects.delete(projectId);
    await db.scopes.where("projectId").equals(projectId).delete();
    await db.baseMaps.where("projectId").equals(projectId).delete();
    await db.blueprints.where("projectId").equals(projectId).delete();
    await db.listings.where("projectId").equals(projectId).delete();
    await db.annotationTemplates.where("projectId").equals(projectId).delete();
    await db.annotations.where("projectId").equals(projectId).delete();

    // Get listing IDs to delete related data
    const listings = await db.listings
      .where("projectId")
      .equals(projectId)
      .toArray();
    const listingIds = listings.map((l) => l.id);

    if (listingIds.length > 0) {
      await db.entities.where("listingId").anyOf(listingIds).delete();
      await db.maps.where("listingId").anyOf(listingIds).delete();
      await db.files.where("listingId").anyOf(listingIds).delete();
      await db.zonings.where("listingId").anyOf(listingIds).delete();
      await db.relsZoneEntity.where("listingId").anyOf(listingIds).delete();
      await db.entitiesProps.where("listingId").anyOf(listingIds).delete();
      await db.legends.where("listingId").anyOf(listingIds).delete();
      await db.relationsEntities.where("listingId").anyOf(listingIds).delete();
      await db.reports.where("listingId").anyOf(listingIds).delete();

      // Get map IDs to delete markers
      const maps = await db.maps.where("listingId").anyOf(listingIds).toArray();
      const mapIds = maps.map((m) => m.id);
      if (mapIds.length > 0) {
        await db.markers.where("mapId").anyOf(mapIds).delete();
      }
    }

    // Get baseMap IDs to delete baseMapViews
    const baseMaps = await db.baseMaps
      .where("projectId")
      .equals(projectId)
      .toArray();
    const baseMapIds = baseMaps.map((b) => b.id);
    if (baseMapIds.length > 0) {
      await db.baseMapViews.where("baseMapId").anyOf(baseMapIds).delete();
    }

    // Get scope IDs to delete syncFiles
    const scopes = await db.scopes
      .where("projectId")
      .equals(projectId)
      .toArray();
    const scopeIds = scopes.map((s) => s.id);
    if (scopeIds.length > 0) {
      await db.syncFiles.where("scopeId").anyOf(scopeIds).delete();
    }

    console.log(
      `Project ${projectId} and all related data deleted successfully`
    );
  };

  return deleteProjects;
}
