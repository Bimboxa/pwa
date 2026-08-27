import db, { withHardDelete, withSystemWrite } from "App/db/db";
import { withoutUndo } from "App/db/undoManager";
import { clearScopeSyncStorage } from "Features/remoteScopeConfigurations/remoteScopeConfigurationsSlice";

// Deletes ALL local data of a project: every Dexie row reachable from the
// projectId plus the project-related localStorage keys (per-scope sync state
// and the "last opened" init pointers). The project stays re-installable from
// the server when remote scope configurations exist.
//
// Global tables are intentionally untouched (same exclusion list as
// createKrtoZip): orgaData, projectFiles, baseMapTransforms, usersDirectory.
//
// withSystemWrite: rows may be owned by other users or live in a read-only
// scope — wiping local data is a device cleanup, not a user edit.
// withoutUndo: a full wipe must not flood the undo stack and must not be
// partially resurrected by Ctrl+Z.
// withHardDelete: tombstones would defeat the purpose of the wipe.
export default async function deleteProjectLocalDataService(projectId) {
  if (!projectId)
    throw new Error("deleteProjectLocalDataService: projectId is required");

  // 1. Collect the id sets needed to reach tables without a projectId index,
  // BEFORE deleting anything.
  const listings = await db.listings
    .where("projectId")
    .equals(projectId)
    .toArray();
  const listingIds = listings.map((l) => l.id);
  const listingKeys = listings.map((l) => l.key).filter(Boolean);

  let mapIds = [];
  if (listingIds.length > 0) {
    const maps = await db.maps.where("listingId").anyOf(listingIds).toArray();
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

  // Legacy safety: resource main files and old file rows may miss projectId.
  const resources = await db.resources
    .where("projectId")
    .equals(projectId)
    .toArray();
  const resourceFileNames = resources.map((r) => r.fileName).filter(Boolean);

  // 2. Hard delete everything in cascade.
  await withSystemWrite(() =>
    withoutUndo(() =>
      withHardDelete(async () => {
        // Tables with a projectId index.
        await db.projects.delete(projectId);
        const byProjectId = [
          db.scopes,
          db.listings,
          db.baseMaps,
          db.baseMapVersions,
          db.blueprints,
          db.annotationTemplates,
          db.annotations,
          db.points,
          db.resources,
          db.entities,
          db.maps,
          db.materials,
          db.zones,
          db.relsZoneAnnotation,
          db.relsZoneEntity,
          db.layers,
          db.povs,
          db.meshes3d,
          db.dimensions3d,
          db.photos,
          db.photoPlans,
          db.entityModels,
          db.relAnnotationMappingCategory,
          db.relAnnotationSubtractions,
          db.relAnnotationMeshCells,
          db.relAnnotationOpenings,
          db.portfolioPages,
          db.portfolioBaseMapContainers,
          db.files, // catches POV raw images + resource main files (no listingId)
        ];
        for (const table of byProjectId) {
          await table.where("projectId").equals(projectId).delete();
        }

        // Tables reachable only through the collected id sets.
        if (listingIds.length > 0) {
          await db.zonings.where("listingId").anyOf(listingIds).delete();
          await db.legends.where("listingId").anyOf(listingIds).delete();
          await db.relationsEntities
            .where("listingId")
            .anyOf(listingIds)
            .delete();
          await db.reports.where("listingId").anyOf(listingIds).delete();
          // Legacy file rows without projectId.
          await db.files.where("listingId").anyOf(listingIds).delete();
        }
        if (listingKeys.length > 0) {
          await db.entitiesProps
            .where("listingKey")
            .anyOf(listingKeys)
            .delete();
        }
        if (mapIds.length > 0) {
          await db.markers.where("mapId").anyOf(mapIds).delete();
        }
        if (baseMapIds.length > 0) {
          await db.baseMapViews.where("baseMapId").anyOf(baseMapIds).delete();
        }
        if (scopeIds.length > 0) {
          await db.baseMapViews.where("scopeId").anyOf(scopeIds).delete();
          await db.syncFiles.where("scopeId").anyOf(scopeIds).delete();
        }
        if (resourceFileNames.length > 0) {
          await db.files.bulkDelete(resourceFileNames);
        }
      })
    )
  );

  // 3. localStorage cleanup.
  scopeIds.forEach((scopeId) => clearScopeSyncStorage(scopeId));

  // "Last opened" pointers: clear them when they reference the wiped project,
  // otherwise the next app init would try to restore a deleted context.
  const scopeIdSet = new Set(scopeIds.map(String));
  const initProjectId = localStorage.getItem("initProjectId");
  const initScopeId = localStorage.getItem("initScopeId");
  if (
    initProjectId === String(projectId) ||
    (initScopeId && scopeIdSet.has(initScopeId))
  ) {
    [
      "initProjectId",
      "initScopeId",
      "initListingId",
      "initSelectedMainBaseMapId",
      "initSelectedModuleKey",
      "initEditorKeyByModule",
      "initPovViewerMode",
    ].forEach((key) => localStorage.removeItem(key));
  }

  console.log(`[projects] local data of project ${projectId} deleted`);

  return { scopeIds };
}
