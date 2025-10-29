import { useDispatch } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import { triggerEntitiesTableUpdate } from "../entitiesSlice";

import useUserEmail from "Features/auth/hooks/useUserEmail";

import db from "App/db/db";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import getEntityPureDataAndFilesDataByKey from "../utils/getEntityPureDataAndFilesDataByKey";

import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

export default function useCreateEntity() {
  const dispatch = useDispatch();
  // data

  const { value: userEmail } = useUserEmail();
  const { value: _listing } = useSelectedListing();

  // helper

  const create = async (data, options) => {
    console.log("[useCreateEntity] data", data, options);

    // listing

    const listing = options?.listing || _listing;

    // table

    const table = listing.table;

    // ids

    let entityId = nanoid();

    // data
    const { pureData, filesDataByKey } =
      await getEntityPureDataAndFilesDataByKey(data, {
        entityId,
        projectId: listing.projectId,
        listingId: listing.id,
        listingTable: listing.table,
        createdBy: userEmail,
      });

    console.log("[useCreateEntity] pureData", pureData, filesDataByKey);

    // store files
    if (filesDataByKey) {
      try {
        await Promise.all(
          Object.entries(filesDataByKey).map(async ([key, fileData]) => {
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
      } catch (e) {
        console.log("[useCreateEntity] error storing files", e);
      }
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
      await db[table].add(entity);

      if (options?.updateSyncFile) {
        await updateItemSyncFile({
          item: entity,
          type: "ENTITY",
          updatedAt: entity.updatedAt ?? entity.createdAt,
          //syncAt: options.syncAt,
        });
      }
      return entity;
    } catch (e) {
      console.log("[db] error adding entity", entity);
    }

    // update table

    dispatch(triggerEntitiesTableUpdate(table));
  };

  return create;
}
