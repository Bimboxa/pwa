import {nanoid} from "@reduxjs/toolkit";
import useUserEmail from "Features/auth/hooks/useUserEmail";

import db from "App/db/db";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import getEntityPureDataAndFilesDataByKey from "../utils/getEntityPureDataAndFilesDataByKey";

import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

export default function useCreateEntity() {
  // data

  const {value: userEmail} = useUserEmail();
  const {value: listing} = useSelectedListing();

  // helper

  const create = async (data, options) => {
    console.log("[useCreateEntity] data", data, options);

    // ids
    const entityId = nanoid();

    // data
    const {pureData, filesDataByKey} = getEntityPureDataAndFilesDataByKey(
      data,
      {
        entityId,
        listingId: listing.id,
      }
    );

    console.log("[useCreateEntity] pureData", pureData, filesDataByKey);

    // store files
    if (filesDataByKey) {
      await Promise.all(
        Object.values(filesDataByKey).map(async (fileData) => {
          await db.files.put(fileData);
        })
      );
    }

    // store entity

    const entity = {
      id: entityId,
      createdBy: userEmail,
      createdAt: new Date().toISOString(),
      listingId: listing.id,
      ...pureData,
    };
    try {
      console.log("[db] adding entity ...", entity);
      await db.entities.add(entity);

      if (options?.updateSyncFile) {
        await updateItemSyncFile({
          item: entity,
          type: "ENTITY",
          updatedAt: options.updatedAt,
          syncAt: options.syncAt,
        });
      }
      return entity;
    } catch (e) {
      console.log("[db] error adding entity", entity);
    }
  };

  return create;
}
