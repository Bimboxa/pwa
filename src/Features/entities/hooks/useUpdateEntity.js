import useUserEmail from "Features/auth/hooks/useUserEmail";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import db from "App/db/db";
import getEntityPureDataAndFilesDataByKey from "../utils/getEntityPureDataAndFilesDataByKey";
import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

export default function useUpdateEntity() {
  // data

  const {value: userEmail} = useUserEmail();
  const {value: listing} = useSelectedListing();

  // helper

  const update = async (entityId, updates, options) => {
    let changes = {
      ...updates,
      updatedBy: userEmail,
      updatedAt: new Date().toISOString(),
    };

    // data
    const {pureData, filesDataByKey} = getEntityPureDataAndFilesDataByKey(
      changes,
      {
        entityId,
        listingId: listing?.id,
        createdBy: userEmail,
      }
    );

    console.log(
      "[useUpdateEntity] pureData-filesDataByKey",
      pureData,
      filesDataByKey
    );

    // store files
    if (filesDataByKey) {
      await Promise.all(
        Object.values(filesDataByKey).map(async (fileData) => {
          await db.files.put(fileData);

          if (options?.updateSyncFile) {
            await updateItemSyncFile({
              item: fileData,
              type: "IMAGE",
              updatedAt: options.updatedAt,
              syncAt: options.syncAt,
            });
          }
        })
      );
    }

    try {
      await db.entities.update(entityId, pureData);

      // sync file
      if (options?.updateSyncFile) {
        await updateItemSyncFile({
          item: pureData,
          type: "ENTITY",
          updatedAt: options.updatedAt,
          syncAt: options.syncAt,
        });
      }
    } catch (e) {
      console.log("[db] error updating the entity", e);
    }
  };

  return update;
}
