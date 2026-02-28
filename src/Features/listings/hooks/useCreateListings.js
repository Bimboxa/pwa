import db from "App/db/db";
import { nanoid } from "@reduxjs/toolkit";

import useUserEmail from "Features/auth/hooks/useUserEmail";
import useCreateRemoteListings from "Features/sync/hooks/useCreateRemoteListings";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";
import useCreateAnnotationTemplatesFromLibrary from "Features/annotations/hooks/useCreateAnnotationTemplatesFromLibrary";

import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";
import resolveListingsInitialEntities from "../services/resolveListingsInitialEntities";
import getEntityPureDataAndFilesDataByKey from "Features/entities/utils/getEntityPureDataAndFilesDataByKey";

export default function useCreateListings() {
  const { value: createdBy } = useUserEmail();

  const createRemoteListings = useCreateRemoteListings();
  const createEntity = useCreateEntity();
  const createAnnotationTemplatesFromLibrary =
    useCreateAnnotationTemplatesFromLibrary();

  const create = async ({ listings, scope }, options) => {
    // process each listing: generate id, set scope/project, handle metadata
    const listingsClean = [];
    for (const listing of listings) {
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
            { entityId: listingId, projectId, listingId, createdBy }
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

      listingsClean.push({
        ...listing,
        id: listingId,
        projectId,
        ...(scope?.id ? { scopeId: scope.id } : {}),
        ...(processedMetadata ? { metadata: processedMetadata } : {}),
        ...(listing?.entityModel?.type
          ? { entityModelType: listing.entityModel.type }
          : {}),
        createdBy,
      });
    }

    // create listings
    await db.listings.bulkAdd(listingsClean);

    // create initial entities
    const initialEntities = resolveListingsInitialEntities({
      listings: listingsClean,
    });
    if (initialEntities?.length > 0) {
      for (const entity of initialEntities) {
        await createEntity(entity, { listing: entity.listing });
      }
    }

    // annotation templates
    for (const listing of listingsClean) {
      if (listing.annotationTemplatesLibrary) {
        await createAnnotationTemplatesFromLibrary(
          listing.annotationTemplatesLibrary,
          { listingId: listing.id, projectId: listing.projectId }
        );
      }
    }

    // remote listings
    if (options?.forceLocalToRemote) {
      await createRemoteListings(listingsClean);
    }

    // update sync files
    if (options?.updateSyncFile) {
      await Promise.all(
        listingsClean.map((listing) =>
          updateItemSyncFile({
            item: listing,
            type: "LISTING",
            updatedAt: options.updatedAt,
            syncAt: options.syncAt,
          })
        )
      );
    }

    return listingsClean;
  };

  return create;
}
