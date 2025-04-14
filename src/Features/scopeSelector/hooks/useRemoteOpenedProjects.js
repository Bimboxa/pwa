import {useSelector} from "react-redux";

export default function useRemoteOpenedProjects() {
  const remoteProjects = useSelector(
    (s) => s.scopeSelector.remoteOpenedProjects
  );

  return remoteProjects;
}
