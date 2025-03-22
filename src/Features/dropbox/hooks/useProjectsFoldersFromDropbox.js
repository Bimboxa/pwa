import {useSelector} from "react-redux";

export default function useProjectsFoldersFromDropbox() {
  const foldersMap = useSelector((state) => state.dropbox.projectsFoldersMap);

  let folders = Object.values(foldersMap);

  return folders;
}
