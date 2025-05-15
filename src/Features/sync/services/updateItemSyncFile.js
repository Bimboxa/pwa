import getRemoteItemPath from "Features/sync/utils/getRemoteItemPath";
import updateSyncFile from "Features/sync/services/updateSyncFile";

export default async function updateItemSyncFile({
  item,
  type,
  updatedAt,
  syncAt,
}) {
  try {
    const {path} = await getRemoteItemPath({
      type,
      item,
    });

    const syncFileTypeByType = {
      PROJECT: "PROJECT",
      SCOPE: "SCOPE",
      LISTING: "LISTING",
      ENTITY: "ENTITIES",
      FILE: "FILE",
    };

    const syncFileType = syncFileTypeByType[type];
    const fileType = item.fileType;
    const listingId = item.listingId;

    await updateSyncFile({
      path,
      syncFileType,
      fileType,
      listingId,
      updatedAt,
      syncAt,
    });
  } catch (e) {
    console.error("[debug] error_33", e, type, item);
  }
}
