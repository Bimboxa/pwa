import useUserEmail from "Features/auth/hooks/useUserEmail";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import db from "App/db/db";
import getEntityPureDataAndFilesDataByKey from "../utils/getEntityPureDataAndFilesDataByKey";

export default function useUpdateEntity() {
  // data

  const {value: userEmail} = useUserEmail();
  const {value: listing} = useSelectedListing();

  // helper

  const update = async (entityId, updates) => {
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
      }
    );

    // store files
    if (filesDataByKey) {
      await Promise.all(
        Object.values(filesDataByKey).map(async (fileData) => {
          await db.files.put(fileData);
        })
      );
    }

    try {
      await db.entities.update(entityId, pureData);
    } catch (e) {
      console.log("[db] error updating the entity", e);
    }
  };

  return update;
}
