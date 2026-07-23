import { nanoid } from "@reduxjs/toolkit";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedScopeId } from "../scopesSlice";

import useUserEmail from "Features/auth/hooks/useUserEmail";
import useCreateListings from "Features/listings/hooks/useCreateListings";
import useCreateRemoteScope from "Features/sync/hooks/useCreateRemoteScope";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";

import db from "App/db/db";

import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

export default function useCreateScope() {
  const dispatch = useDispatch();
  const { value: createdBy } = useUserEmail();

  const createListings = useCreateListings();
  const createRemoteScope = useCreateRemoteScope();
  const createEntity = useCreateEntity();
  const _projectId = useSelector((s) => s.projects.selectedProjectId);
  const createdByTrigram = useSelector(
    (s) => s.auth.userProfile?.trigram ?? null
  );

  const create = async (
    {
      id,
      name,
      clientRef,
      projectId,
      newListings,
      newEntities,
      presetScopeKey,
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
    const scope = {
      id: id ?? nanoid(),
      presetScopeKey,
      createdBy,
      createdByTrigram,
      name,
      clientRef,
      projectId: projectId ?? _projectId,
      isPublic: false,
    };
    await db.scopes.add(scope);
    console.log("debug_25_04 [db] added scope", scope);
    // Select the new scope right away so the follow-up listings/entities
    // writes never hit the read-only guard of a previously selected scope.
    dispatch(setSelectedScopeId(scope.id));

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
