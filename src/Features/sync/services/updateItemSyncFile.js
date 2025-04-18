import getRemoteItemPath from "Features/sync/utils/getRemoteItemPath";
import updateSyncFile from "Features/sync/services/updateSyncFile";

export default async function updateItemSyncFile({item, type}) {
  try {
    const path = getRemoteItemPath({
      type,
      item,
    });
    console.log("[debug] updateSyncFile", path);
    await updateSyncFile(path);
  } catch (e) {
    console.error("[debug] error", e);
  }
}
