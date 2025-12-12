import { useDispatch, useSelector } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import { triggerEntitiesTableUpdate } from "../entitiesSlice";

import useUserEmail from "Features/auth/hooks/useUserEmail";
import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";

import db from "App/db/db";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import getEntityPureDataAndFilesDataByKey from "../utils/getEntityPureDataAndFilesDataByKey";

import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

export default function useCreateEntity() {
  const dispatch = useDispatch();
  // data

  const { value: userEmail } = useUserEmail();
  const { value: _listing } = useSelectedListing();
  const createAnnotation = useCreateAnnotation();

  // helper

  const create = async (data, options) => {
    // options

    const listingOption = options?.listing;
    const updateSyncFile = options?.updateSyncFile;
    const annotation = options?.annotation;

    // data

    if (annotation?.imageFile) {
      data.image = { file: annotation.imageFile };
    }

    // listingP

    const listing = listingOption || _listing;

    // table

    const table = listing.table ?? listing?.entityModel.defaultTable;

    // ids

    let entityId = data?.id ?? nanoid();

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
            if (updateSyncFile) {
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

      if (annotation) {
        await createAnnotation({
          ...annotation,
          entityId: entity.id,
          listingId: listing.id,
          listingTable: listing.table,
        });
      }
      if (updateSyncFile) {
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
