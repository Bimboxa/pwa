import getRemoteItemPath from "Features/sync/utils/getRemoteItemPath";
import updateSyncFile from "Features/sync/services/updateSyncFile";
import syncFileTypeByItemType from "../data/syncFileTypeByItemType";

export default async function updateItemSyncFile({
  item,
  type,
  updatedAt,
  syncAt,
}) {
  try {
    const {path} = getRemoteItemPath({
      type,
      item,
    });
    console.log("[debug] updateSyncFile", path);
    const syncFileType = syncFileTypeByItemType[type];
    await updateSyncFile({path, syncFileType, updatedAt, syncAt});
  } catch (e) {
    console.error("[debug] error", e);
  }
}
