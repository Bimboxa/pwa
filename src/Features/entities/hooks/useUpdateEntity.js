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

    let changes = {
      ...updates,
      updatedBy: userEmail,
      updatedAt: new Date().toISOString(),
    };

    // data
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

    // store files
    if (filesDataByKey) {
      await Promise.all(
        Object.values(filesDataByKey).map(async (fileData) => {
          await db.files.put(fileData);
          //
          if (options?.updateSyncFile) {
            await updateItemSyncFile({
              item: fileData,
              type: "FILE",
              updatedAt: fileData.updatedAt,
              //syncAt: options.syncAt,
            });
          }
        })
      );
    }

    try {
      await db[table]?.update(entityId, pureData);

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
      console.error("[db] error updating the entity", e);
    }

    // update table
    dispatch(triggerEntitiesTableUpdate(table));
  };

  return update;
}
