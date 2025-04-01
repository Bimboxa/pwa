import {useEffect} from "react";

import {useDispatch} from "react-redux";

import {setIsConnectingToRemoteProjectContainer} from "../syncSlice";
import getRemoteProjectContainerProps from "../services/getRemoteProjectContainerProps";

export default function useInitRemoteProjectContainer() {
  const dispatch = useDispatch();

  // data

  const remoteProjectContainerProps = getRemoteProjectContainerProps();
  const remoteProjectContainerPropsUpdatedAt = useSelector(
    (s) => s.sync.remoteProjectContainerPropsUpdatedAt
  );

  useEffect(() => {
    if (remoteProjectContainerProps) {
      dispatch(setIsConnectingToRemoteProjectContainer(true));
    }
  }, [remoteProjectContainerPropsUpdatedAt]);
}
