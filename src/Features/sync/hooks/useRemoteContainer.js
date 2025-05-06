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

  // update remoteContainer if appConfig changes
  // used to update redux state with data from appConfig

  useEffect(() => {
    console.log(
      "[EFFECT] useRemoteContainer",
      appConfig?.name,
      appConfig?.version
    );
    if (appConfig?.remoteContainers) {
      const remoteContainer = appConfig.remoteContainers.find((container) => {
        return container.service === remoteContainerInRedux?.service;
      });

      if (remoteContainer) {
        dispatch(setRemoteContainer(remoteContainer));
      }
    }
  }, [appConfig?.version, appConfig?.name]);

  return remoteContainerInRedux;
}
