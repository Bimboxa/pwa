import {useSelector} from "react-redux";

export default function useSyncFilesToPush() {
  const syncFiles = useSelector((s) => s.sync.syncFiles);

  const syncFilesToPush = syncFiles.filter((syncFile) => {
    return syncFile.updatedAt !== syncFile.syncAt;
  });

  return syncFilesToPush;
}
