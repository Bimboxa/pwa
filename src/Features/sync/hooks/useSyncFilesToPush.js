import {useSelector} from "react-redux";

export default function useSyncFilesToPush() {
  const syncFiles = useSelector((s) => s.sync.syncFiles);
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

  const syncFilesToPush = syncFiles.filter((syncFile) => {
    return (
      syncFile.updatedAt !== syncFile.syncAt &&
      (syncFile.scopeId === selectedScopeId ||
        syncFile.itemType === "PROJECT" ||
        syncFile.itemType === "SCOPE")
    );
  });

  return syncFilesToPush;
}
