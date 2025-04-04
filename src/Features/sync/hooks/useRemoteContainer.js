import {useSelector} from "react-redux";

export default function useRemoteContainer() {
  const remoteContainerInRedux = useSelector(
    (state) => state.sync.remoteContainer
  );

  return remoteContainerInRedux;
}
