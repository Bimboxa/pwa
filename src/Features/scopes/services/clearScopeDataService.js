import db, { withHardDelete } from "App/db/db";

export default async function clearScopeDataService(scopeId) {
    if (!scopeId) throw new Error("scopeId manquant");

    console.log("[clearScopeDataService] clearing data for scope", scopeId);

    // 1. Collecter les ids dépendants (listings du scope)
    const listings = await db.listings.where("scopeId").equals(scopeId).toArray();
    const listingIds = listings.map((l) => l.id);

    // 2. Hard delete en cascade
    await withHardDelete(async () => {
        // Tables avec scopeId direct
        await db.baseMapViews.where("scopeId").equals(scopeId).delete();
        await db.blueprints.where("scopeId").equals(scopeId).delete();
        await db.syncFiles.where("scopeId").equals(scopeId).delete();
        await db.portfolioPages.where("scopeId").equals(scopeId).delete();
        await db.portfolioBaseMapContainers.where("scopeId").equals(scopeId).delete();
        await db.layers.where("scopeId").equals(scopeId).delete();

        // Tables liées par listingId (entities, maps, etc.)
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
            await db.baseMaps.where("listingId").anyOf(listingIds).delete();
            await db.baseMapVersions.where("listingId").anyOf(listingIds).delete();
            await db.points.where("listingId").anyOf(listingIds).delete();
            await db.annotations.where("listingId").anyOf(listingIds).delete();
            await db.annotationTemplates.where("listingId").anyOf(listingIds).delete();
        }

        // Listings (en dernier pour ne pas perdre la liste avant de cascader)
        await db.listings.where("scopeId").equals(scopeId).delete();
    });

    console.log("[clearScopeDataService] done for scope", scopeId);
}
