import {useEffect} from "react";
import {useSelector, useDispatch} from "react-redux";

import {setRemoteContainer} from "../syncSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function useRemoteContainer() {
  const dispatch = useDispatch();

  const remoteContainerInRedux = useSelector(
    (state) => state.sync.remoteContainer
  );

  const appConfig = useAppConfig();

  useEffect(() => {
    console.log("[EFFECT] useRemoteContainer", appConfig.version);
    if (appConfig.remoteContainers) {
      const remoteContainer = appConfig.remoteContainers.find((container) => {
        return container.service === remoteContainerInRedux?.service;
      });

      if (remoteContainer) {
        dispatch(setRemoteContainer(remoteContainer));
      }
    }
  }, [appConfig.version]);

  return remoteContainerInRedux;
}
