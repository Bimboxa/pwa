import {nanoid} from "@reduxjs/toolkit";
import {useDispatch} from "react-redux";

import {triggerZonesUpdate} from "../zonesSlice";

import useUserEmail from "Features/auth/hooks/useUserEmail";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

import getDateString from "Features/misc/utils/getDateString";

import db from "App/db/db";

export default function useCreateOrUpdateZonesTree() {
  const dispatch = useDispatch();

  const {value: createdBy} = useUserEmail();
  const createdAt = getDateString(new Date());
  const updatedAt = getDateString(new Date());

  const {value: selectedListing} = useSelectedListing();

  const createOrUpdate = async ({listing, zonesTree}, options) => {
    try {
      // listingId
      const _listing = listing || selectedListing;
      if (!_listing) {
        throw new Error("No listingId provided");
      }

      const _listingId = _listing.id;

      // create or update
      const table = _listing?.table;
      const exitingEntity = await db[table].get(_listingId);
      let entity;

      // create
      if (!exitingEntity) {
        entity = {
          createdBy,
          createdAt,
          listingId: _listingId,
          zonesTree,
        };
        await db[table].add(entity);
        console.log("[db] zones entity updated", entity);
      } else {
        // update
        entity = {
          ...exitingEntity,
          updatedAt,
          zonesTree,
        };
        await db[table].update(exitingEntity.listingId, entity);
        console.log("[db] zones entity updated", entity);
      }
      dispatch(triggerZonesUpdate());

      // update syncFiles
      if (options?.updateSyncFile) {
        await updateItemSyncFile({
          item: entity,
          type: "ZONING",
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
