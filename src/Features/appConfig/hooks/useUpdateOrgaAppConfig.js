import {useDispatch} from "react-redux";

import {setAppConfig} from "../appConfigSlice";

import useToken from "Features/auth/hooks/useToken";

import postOrgaAppConfigService from "../services/postOrgaAppConfigService";
import setAppConfigInLocalStorage from "../services/setAppConfigInLocalStorage";
import setRemoteContainerInLocalStorage from "Features/sync/services/setRemoteContainerInLocalStorage";

export default function useUpdateOrgaAppConfig() {
  const dispatch = useDispatch();
  const accessToken = useToken();

  return async (appConfig) => {
    await postOrgaAppConfigService({accessToken, appConfig});
    setAppConfigInLocalStorage(appConfig);
    setRemoteContainerInLocalStorage(null);
    dispatch(setAppConfig(appConfig));
  };
}
