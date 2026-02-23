import db from "App/db/db";
import { nanoid } from "@reduxjs/toolkit";

import useUserEmail from "Features/auth/hooks/useUserEmail";
import useCreateRemoteListings from "Features/sync/hooks/useCreateRemoteListings";
import useCreateAnnotationTemplatesFromLibrary from "Features/annotations/hooks/useCreateAnnotationTemplatesFromLibrary";

import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";

export default function useCreateListing() {
  const { value: createdBy } = useUserEmail();

  const createRemoteListings = useCreateRemoteListings();
  const createAnnotationTemplatesFromLibrary = useCreateAnnotationTemplatesFromLibrary();


  const create = async ({ listing, scope }, options) => {
    console.log("debug_3009_create_listing", listing);
    const listingClean = {
      ...listing,
      id: listing?.id ?? nanoid(),
      projectId: listing?.projectId ?? scope?.projectId,
      ...(scope?.id ? { scopeId: scope.id } : {}),
      createdBy,
    };
    // create listings
    await db.listings.add(listingClean);

    // remote listings
    if (options?.forceLocalToRemote) {
      await createRemoteListings([listingClean]);
    }

    // annotation templates
    if (listingClean.annotationTemplatesLibrary) {
      await createAnnotationTemplatesFromLibrary(
        listingClean.annotationTemplatesLibrary,
        {
          listingId: listingClean.id,
          projectId: listingClean.projectId,
        }
      );
    }

    // update sync file
    if (options?.updateSyncFile) {
      updateItemSyncFile({
        item: listingClean,
        type: "LISTING",
        updatedAt: options.updatedAt,
        syncAt: options.syncAt,
      });
    }
    // return
    return listingClean;
  };

  return create;
}
