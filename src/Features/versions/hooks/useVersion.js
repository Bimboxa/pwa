import { useSelector } from "react-redux";
import useVersions from "./useVersions";

export default function useVersion() {
  const versionId = useSelector((state) => state.versions.selectedVersionId);
  const versions = useVersions();

  return versions?.find((version) => version.id === versionId);
}
