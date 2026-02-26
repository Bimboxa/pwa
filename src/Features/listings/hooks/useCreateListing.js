import db from "App/db/db";
import { nanoid } from "@reduxjs/toolkit";

import useUserEmail from "Features/auth/hooks/useUserEmail";
import useCreateRemoteListings from "Features/sync/hooks/useCreateRemoteListings";
import useCreateAnnotationTemplatesFromLibrary from "Features/annotations/hooks/useCreateAnnotationTemplatesFromLibrary";

import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";
import getEntityPureDataAndFilesDataByKey from "Features/entities/utils/getEntityPureDataAndFilesDataByKey";

export default function useCreateListing() {
  const { value: createdBy } = useUserEmail();

  const createRemoteListings = useCreateRemoteListings();
  const createAnnotationTemplatesFromLibrary = useCreateAnnotationTemplatesFromLibrary();


  const create = async ({ listing, scope }, options) => {
    console.log("debug_3009_create_listing", listing);
    const listingId = listing?.id ?? nanoid();
    const projectId = listing?.projectId ?? scope?.projectId;

    // process metadata files
    let processedMetadata = listing?.metadata;
    let metadataFilesDataByKey = null;

    if (listing?.metadata) {
      const hasFiles = Object.values(listing.metadata).some(
        (v) => v?.file instanceof File
      );
      if (hasFiles) {
        const result = await getEntityPureDataAndFilesDataByKey(
          listing.metadata,
          {
            entityId: listingId,
            projectId,
            listingId,
            createdBy,
          }
        );
        if (result) {
          const { pureData, filesDataByKey } = result;
          delete pureData.projectId;
          processedMetadata = pureData;
          metadataFilesDataByKey = filesDataByKey;
        }
      }
    }

    // store metadata files
    if (metadataFilesDataByKey) {
      const allFilesToStore = Object.values(metadataFilesDataByKey).flat();
      await Promise.all(
        allFilesToStore.map(async (fileData) => {
          await db.files.put(fileData);
          if (options?.updateSyncFile) {
            await updateItemSyncFile({
              item: fileData,
              type: "FILE",
              updatedAt: fileData.updatedAt,
            });
          }
        })
      );
    }

    const listingClean = {
      ...listing,
      id: listingId,
      projectId,
      ...(scope?.id ? { scopeId: scope.id } : {}),
      ...(processedMetadata ? { metadata: processedMetadata } : {}),
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
