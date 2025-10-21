import { useSelector } from "react-redux";

export default function useVersions() {
  const versions = useSelector((state) => state.versions.items);

  return versions;
}
