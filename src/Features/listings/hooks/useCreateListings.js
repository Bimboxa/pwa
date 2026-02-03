import db from "App/db/db";
import { nanoid } from "@reduxjs/toolkit";

import useUserEmail from "Features/auth/hooks/useUserEmail";
import useCreateRemoteListings from "Features/sync/hooks/useCreateRemoteListings";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useCreateAnnotationTemplatesFromLibrary from "Features/annotations/hooks/useCreateAnnotationTemplatesFromLibrary";

import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";
import getDateString from "Features/misc/utils/getDateString";
import resolveListingsInitialEntities from "../services/resolveListingsInitialEntities";

export default function useCreateListings() {
  const { value: createdBy } = useUserEmail();
  const createdAt = getDateString(new Date());

  const createRemoteListings = useCreateRemoteListings();
  const createEntity = useCreateEntity();
  const createAnnotationTemplatesFromLibrary = useCreateAnnotationTemplatesFromLibrary();

  const create = async ({ listings, scope }, options) => {
    const listingsClean = listings.map((listing) => {
      return {
        ...listing,
        id: listing?.id ?? nanoid(),
        projectId: listing?.projectId ?? scope?.projectId,
        createdBy,
        createdAt,
        updatedAt: createdAt,
      };
    });


    console.log("debug_0302_createListings", listingsClean);
    // create listings
    await db.listings.bulkAdd(listingsClean);

    // create entities

    const initialEntities = resolveListingsInitialEntities({
      listings: listingsClean,
    });

    if (initialEntities?.length > 0) {
      for (let entity of initialEntities) {
        const options = { listing: entity.listing };
        await createEntity(entity, options);
      }
    }


    // annotation templates

    for (let listing of listingsClean) {
      if (listing.annotationTemplatesLibrary) {
        await createAnnotationTemplatesFromLibrary(
          listing.annotationTemplatesLibrary,
          {
            listingId: listing.id,
            projectId: listing.projectId,
          }
        );
      }
    }

    // remote listings
    if (options?.forceLocalToRemote) {
      await createRemoteListings(listingsClean);
    }
    // update sync file
    if (options?.updateSyncFile) {
      await Promise.all(
        listingsClean.map((listing) => {
          return updateItemSyncFile({
            item: listing,
            type: "LISTING",
            updatedAt: options.updatedAt,
            syncAt: options.syncAt,
          });
        })
      );
    }

    // return

    return listingsClean;
  };

  return create;
}
