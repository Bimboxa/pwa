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
    await updateSyncFile({path, itemType: type, updatedAt, syncAt});
  } catch (e) {
    console.error("[debug] error", e);
  }
}
