import { useDispatch } from "react-redux";

import { triggerEntitiesTableUpdate } from "../entitiesSlice";

import useUserEmail from "Features/auth/hooks/useUserEmail";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import db from "App/db/db";
import getEntityPureDataAndFilesDataByKey from "../utils/getEntityPureDataAndFilesDataByKey";
import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

export default function useUpdateEntity() {
  const dispatch = useDispatch();

  // data
  const { value: userEmail } = useUserEmail();
  const { value: listing } = useSelectedListing();

  const update = async (entityId, updates, options) => {
    // options
    const _listing = options?.listing ?? listing;

    // main
    const table = _listing?.table;

    // 1. LOGIQUE DE SUPPRESSION D'IMAGES (Clean-up)
    // On vérifie si le champ 'images' est modifié
    if (updates.images && Array.isArray(updates.images)) {
      try {
        // A. On récupère l'entité actuelle en base pour avoir l'ancienne liste
        const currentEntity = await db[table].get(entityId);

        if (currentEntity && Array.isArray(currentEntity.images)) {
          const oldImages = currentEntity.images;

          // B. On liste les IDs (fileName) qui sont conservés dans la nouvelle mise à jour.
          // Note : Les nouvelles images (File) n'ont pas encore de fileName, on les ignore ici.
          const keptFileNames = updates.images
            .map((img) => img.fileName)
            .filter(Boolean); // On garde seulement ceux qui ont un fileName (les existants)

          // C. On trouve les orphelins : présents avant, mais absents de la nouvelle liste
          const imagesToDelete = oldImages.filter(
            (oldImg) => oldImg.fileName && !keptFileNames.includes(oldImg.fileName)
          );

          // D. Suppression effective
          if (imagesToDelete.length > 0) {
            console.log("[useUpdateEntity] deleting orphan images:", imagesToDelete);

            await Promise.all(
              imagesToDelete.map(async (imgToDelete) => {
                // 1. Suppression DB locale
                // On suppose que la clé primaire de 'files' est fileName
                await db.files.delete(imgToDelete.fileName);

                // 2. Gestion Sync (Suppression distante)
                if (options?.updateSyncFile) {
                  await updateItemSyncFile({
                    item: { ...imgToDelete, _deleted: true }, // Marqueur de suppression
                    type: "FILE",
                    updatedAt: new Date().toISOString(),
                    // syncAt: options.syncAt,
                  });
                }
              })
            );
          }
        }
      } catch (e) {
        console.error("[useUpdateEntity] Error managing deleted images", e);
      }
    }

    // 2. PREPARATION DES DONNEES (Comme avant)
    let changes = {
      ...updates,
      updatedBy: userEmail,
      updatedAt: new Date().toISOString(),
    };

    // Transform data (Raw Files -> Binary Data & Metadata)
    const { pureData, filesDataByKey } =
      await getEntityPureDataAndFilesDataByKey(changes, {
        entityId,
        listingId: _listing?.id,
        listingTable: _listing?.table,
        projectId: _listing?.projectId,
        createdBy: userEmail,
      });

    console.log(
      "[useUpdateEntity] pureData-filesDataByKey",
      pureData,
      filesDataByKey
    );

    // 3. STORE NEW/UPDATED FILES
    if (filesDataByKey) {
      try {
        const allFilesToStore = Object.values(filesDataByKey).flat();

        await Promise.all(
          allFilesToStore.map(async (fileData) => {
            await db.files.put(fileData);

            if (options?.updateSyncFile) {
              await updateItemSyncFile({
                item: fileData,
                type: "FILE",
                updatedAt: fileData.updatedAt,
              });
            }
          })
        );
      } catch (e) {
        console.error("[useUpdateEntity] error storing files", e);
      }
    }

    // 4. UPDATE ENTITY
    try {
      await db[table]?.update(entityId, pureData);

      // sync entity
      if (options?.updateSyncFile) {
        const itemForSync = { id: entityId, ...pureData };
        await updateItemSyncFile({
          item: itemForSync,
          type: "ENTITY",
          updatedAt: pureData.updatedAt,
          syncAt: options.syncAt,
        });
      }
    } catch (e) {
      console.error("[db] error updating the entity", e);
    }

    // update table
    dispatch(triggerEntitiesTableUpdate(table));
  };

  return update;
}