import {nanoid} from "@reduxjs/toolkit";
import {useDispatch} from "react-redux";

import {triggerZonesUpdate} from "../zonesSlice";

import useUserEmail from "Features/auth/hooks/useUserEmail";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

import db from "App/db/db";

export default function useCreateOrUpdateZonesTree() {
  const dispatch = useDispatch();

  const createdBy = useUserEmail();
  const createdAt = new Date().toISOString();
  const updatedAt = new Date().toISOString();

  const {value: listing} = useSelectedListing();

  const createOrUpdate = async ({listingId, zonesTree}, options) => {
    try {
      // listingId
      const _listingId = listingId || listing?.id;
      if (!_listingId) {
        throw new Error("No listingId provided");
      }

      // create or update
      const table = listing?.table;
      const exitingEntity = await db[table]
        .where("listingId")
        .equals(_listingId)
        .first();

      // create
      if (!exitingEntity) {
        const entity = {
          id: nanoid(),
          createdBy,
          createdAt,
          listingId: _listingId,
          zonesTree,
        };
        await db[table].add(entity);
        console.log("[db] zones entity updated", entity);
      } else {
        // update
        const entity = {
          ...exitingEntity,
          updatedAt,
          zonesTree,
        };
        await db[table].update(exitingEntity.id, entity);
        console.log("[db] zones entity updated", entity);
      }
      dispatch(triggerZonesUpdate());

      // update syncFiles
      if (options?.updateSyncFile) {
        await updateItemSyncFile({
          item: entity,
          type: "ZONES_TREE",
          updatedAt: options.updatedAt,
          syncAt: options.syncAt,
        });
      }
    } catch (e) {
      console.log(e);
      return;
    }
  };

  return createOrUpdate;
}
