import {useDispatch} from "react-redux";

import {setRemoteProjectsContainers} from "../syncSlice";
import {useEffect} from "react";

import appConfigAsync from "App/appConfigAsync";

export default function useInitRemoteProjectsContainers() {
  const dispatch = useDispatch();

  useEffect(() => {
    appConfigAsync.then((appConfig) => {
      dispatch(setRemoteProjectsContainers(appConfig.remoteProjectsContainers));
    });
  }, []);
}
