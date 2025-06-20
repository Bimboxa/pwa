import {useSelector} from "react-redux";
import useRemoteContainer from "./useRemoteContainer";

export default function useSyncFilesToPush() {
  const syncFiles = useSelector((s) => s.sync.syncFiles);
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const remoteContainer = useRemoteContainer();

  console.log("syncFiles", syncFiles);
  const syncFilesToPush = syncFiles.filter((syncFile) => {
    return (
      syncFile?.path?.startsWith(remoteContainer?.path) &&
      (syncFile.updatedAt > syncFile.syncAt || !syncFile.syncAt) &&
      (syncFile.scopeId === selectedScopeId ||
        syncFile.syncFileType === "PROJECT" ||
        syncFile.syncFileType === "SCOPE" ||
        syncFile.syncFileType === "LISTING")
    );
  });

  return syncFilesToPush;
}
