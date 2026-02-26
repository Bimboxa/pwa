import db from "App/db/db";

import useUserEmail from "Features/auth/hooks/useUserEmail";
import updateItemSyncFile from "Features/sync/services/updateItemSyncFile";
import getEntityPureDataAndFilesDataByKey from "Features/entities/utils/getEntityPureDataAndFilesDataByKey";

export default function useUpdateListing() {
  const { value: userEmail } = useUserEmail();

  const update = async (updates, options) => {
    const listingId = updates.id;
    let processedUpdates = updates;

    // handle metadata files
    if (updates.metadata) {
      const currentListing = await db.listings.get(listingId);

      // 1. cleanup orphaned files
      if (currentListing?.metadata) {
        const oldFileEntries = Object.entries(currentListing.metadata).filter(
          ([, value]) => value?.fileName
        );
        const newFileNames = Object.values(updates.metadata)
          .filter((v) => v?.fileName)
          .map((v) => v.fileName);

        const orphanedFiles = oldFileEntries.filter(
          ([, value]) => !newFileNames.includes(value.fileName)
        );

        if (orphanedFiles.length > 0) {
          await Promise.all(
            orphanedFiles.map(async ([, value]) => {
              await db.files.delete(value.fileName);
              if (options?.updateSyncFile) {
                await updateItemSyncFile({
                  item: { ...value, _deleted: true },
                  type: "FILE",
                  updatedAt: new Date().toISOString(),
                });
              }
            })
          );
        }
      }

      // 2. process new files in metadata
      const hasFiles = Object.values(updates.metadata).some(
        (v) => v?.file instanceof File
      );
      if (hasFiles) {
        const result = await getEntityPureDataAndFilesDataByKey(
          updates.metadata,
          {
            entityId: listingId,
            projectId: currentListing?.projectId,
            listingId,
            createdBy: userEmail,
          }
        );
        if (result) {
          const { pureData, filesDataByKey } = result;
          delete pureData.projectId;

          // 3. store new files
          if (filesDataByKey) {
            const allFilesToStore = Object.values(filesDataByKey).flat();
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

          processedUpdates = { ...updates, metadata: pureData };
        }
      }
    }

    await db.listings.update(listingId, processedUpdates);
    //
    const listing = await db.listings.get(listingId);
    await updateItemSyncFile({item: listing, type: "LISTING"});

    // sync file
    if (options?.updateSyncFile) {
      const props = {item: listing, type: "LISTING"};
      if (options.updatedAt) props.updatedAt = options.updatedAt;
      if (options.syncAt) props.syncAt = options.syncAt;
      await updateItemSyncFile(props);
    }
  };

  return update;
}
