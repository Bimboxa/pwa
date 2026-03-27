import { useDispatch } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";

import { triggerEntitiesTableUpdate } from "../entitiesSlice";

import useUserEmail from "Features/auth/hooks/useUserEmail";

import db from "App/db/db";
import getEntityPureDataAndFilesDataByKey from "../utils/getEntityPureDataAndFilesDataByKey";

/**
 * Bulk version of useCreateEntity.
 * Inserts all entities in a single bulkAdd + single dispatch.
 */
export default function useCreateEntities() {
  const dispatch = useDispatch();

  // data
  const { value: userEmail } = useUserEmail();

  // helper
  const createMany = async (items, options) => {
    // items: Array of { data, listing }
    // options: { table }
    const table = options?.table;
    if (!table || !items?.length) return [];

    // 1. Prepare all entities (pure data + files)
    const entities = [];
    const allFiles = [];

    for (const { data, listing } of items) {
      const entityId = data?.id ?? nanoid();

      const result = await getEntityPureDataAndFilesDataByKey(data, {
        entityId,
        projectId: listing.projectId,
        listingId: listing.id,
        listingTable: table,
        createdBy: userEmail,
      });

      if (!result) continue;

      const { pureData, filesDataByKey } = result;

      entities.push({
        id: entityId,
        createdBy: userEmail,
        listingId: listing.id,
        ...pureData,
      });

      // collect files
      if (filesDataByKey) {
        allFiles.push(...Object.values(filesDataByKey).flat());
      }
    }

    // 2. Bulk store files
    if (allFiles.length > 0) {
      await Promise.all(allFiles.map((fileData) => db.files.put(fileData)));
    }

    // 3. Bulk store entities
    if (entities.length > 0) {
      await db[table].bulkAdd(entities);
      dispatch(triggerEntitiesTableUpdate(table));
    }

    return entities;
  };

  return createMany;
}
