import {useSelector} from "react-redux";

export default function useProjectsFoldersFromDropbox() {
  const foldersMap = useSelector((state) => state.dropbox.projectsFoldersMap);

  let folders = Array.from(foldersMap.values());

  return folders;
}
