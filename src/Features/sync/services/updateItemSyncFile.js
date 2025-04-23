import getRemoteItemPath from "Features/sync/utils/getRemoteItemPath";
import updateSyncFile from "Features/sync/services/updateSyncFile";
import syncFileTypeByItemType from "../data/syncFileTypeByItemType";

export default async function updateItemSyncFile({item, type}) {
  try {
    const path = getRemoteItemPath({
      type,
      item,
    });
    console.log("[debug] updateSyncFile", path);
    const syncFileType = syncFileTypeByItemType[type];
    await updateSyncFile({path, syncFileType});
  } catch (e) {
    console.error("[debug] error", e);
  }
}
