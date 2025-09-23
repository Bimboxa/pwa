import { nanoid } from "@reduxjs/toolkit";

import { useSelector } from "react-redux";

import useUserEmail from "Features/auth/hooks/useUserEmail";
import useCreateListings from "Features/listings/hooks/useCreateListings";
import useCreateRemoteScope from "Features/sync/hooks/useCreateRemoteScope";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";

import db from "App/db/db";

import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

export default function useCreateScope() {
  const { value: createdBy } = useUserEmail();
  const createdAt = new Date(Date.now()).toISOString();

  const createListings = useCreateListings();
  const createRemoteScope = useCreateRemoteScope();
  const createEntity = useCreateEntity();
  const _projectId = useSelector((s) => s.projects.selectedProjectId);

  const create = async (
    {
      id,
      name,
      clientRef,
      projectId,
      newListings,
      newEntities,
      sortedListings,
    },
    options
  ) => {
    // options

    const updateSyncFile = options?.updateSyncFile;
    const forceLocalToRemote = options?.forceLocalToRemote;

    //
    const listingsWithIds = newListings?.map((listing) => {
      return {
        ...listing,
        id: listing?.id ?? nanoid(),
      };
    });
    //
    sortedListings =
      sortedListings ??
      listingsWithIds?.map((listing) => ({
        id: listing.id,
        table: listing.table,
      }));
    //
    const scope = {
      id: id ?? nanoid(),
      createdBy,
      createdAt,
      name,
      clientRef,
      projectId: projectId ?? _projectId,
      sortedListings,
    };
    await db.scopes.add(scope);
    console.log("debug_25_04 [db] added scope", scope);

    // update sync file
    if (updateSyncFile) {
      await updateItemSyncFile({
        item: scope,
        type: "SCOPE",
        updatedAt: options.updatedAt,
        syncAt: options.syncAt,
      });
    }

    // remoteScope
    if (forceLocalToRemote) {
      await createRemoteScope(scope);
    }

    // add listings
    if (newListings?.length > 0) {
      await createListings(
        { listings: listingsWithIds, scope },
        { updateSyncFile: options?.updateSyncFile }
      );
    }

    // add entities
    if (newEntities?.length > 0) {
      for (let entity of newEntities) {
        await createEntity(entity, { listing: entity.listing });
      }
    }

    // return
    return scope;
  };

  return create;
}
