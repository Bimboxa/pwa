import getRemoteItemPath from "Features/sync/utils/getRemoteItemPath";
import updateSyncFile from "Features/sync/services/updateSyncFile";
import store from "App/store";

export default async function updateSyncFileProject({project}) {
  try {
    const remoteContainer = store.getState().sync.remoteContainer;
    const path = getRemoteItemPath({
      type: "PROJECT",
      remoteContainer,
      item: project,
    });
    console.log("[debug] updateSyncFileProject", path);
    await updateSyncFile(path);
  } catch (e) {
    console.error("[debug] error", e);
  }
}
