import getRemoteItemPath from "Features/sync/utils/getRemoteItemPath";
import updateSyncFile from "Features/sync/services/updateSyncFile";
import store from "App/store";
export default async function updateItemSyncFile({
  item,
  type,
  updatedAt,
  syncAt,
}) {
  try {
    const remoteContainer = store.getState().appConfig.value.remoteContainer;
    const itemPath = await getRemoteItemPath({
      type,
      item,
      remoteContainer,
    });

    const path = itemPath?.path;

    if (!path) return;

    const syncFileTypeByType = {
      PROJECT: "PROJECT",
      SCOPE: "SCOPE",
      LISTING: "LISTING",
      ENTITY: "ENTITIES",
      MARKER: "MARKERS",
      ZONING: "ZONING",
      FILE: "FILE",
    };

    const syncFileType = syncFileTypeByType[type];
    const fileType = item.fileType;

    let listingId = item.listingId;
    if (item.syncFileType === "LISTING") listingId = item.id;

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
