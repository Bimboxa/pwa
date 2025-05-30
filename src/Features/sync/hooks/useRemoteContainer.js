import {useEffect} from "react";
import {useSelector, useDispatch} from "react-redux";

import {setRemoteContainer} from "../syncSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function useRemoteContainer() {
  // data
  const disableRemoteContainer = useSelector(
    (s) => s.sync.disableRemoteContainer
  );
  const appConfig = useAppConfig();

  if (disableRemoteContainer) return null;
  return appConfig?.remoteContainer;

  const dispatch = useDispatch();

  const remoteContainerInRedux = useSelector(
    (state) => state.sync.remoteContainer
  );

  const forceUpdateAt = useSelector((s) => s.appConfig.forceUpdateAt);

  // update remoteContainer if appConfig changes
  // used to update redux state with data from appConfig

  useEffect(() => {
    console.log(
      "[EFFECT] useRemoteContainer",
      appConfig?.name,
      appConfig?.version
    );

    if (appConfig?.name) {
      dispatch(setRemoteContainer(appConfig?.remoteContainer));
    }
  }, [appConfig?.version, appConfig?.name, forceUpdateAt]);

  return remoteContainerInRedux;
}
