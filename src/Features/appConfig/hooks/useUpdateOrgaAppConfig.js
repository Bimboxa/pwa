import {useDispatch} from "react-redux";

import {setAppConfig} from "../appConfigSlice";

import useToken from "Features/auth/hooks/useToken";

import postOrgaAppConfigService from "../services/postOrgaAppConfigService";
import setAppConfigInLocalStorage from "../services/setAppConfigInLocalStorage";

export default function useUpdateOrgaAppConfig() {
  const dispatch = useDispatch();
  const accessToken = useToken();

  return async (appConfig) => {
    await postOrgaAppConfigService({accessToken, appConfig});
    setAppConfigInLocalStorage(appConfig);
    dispatch(setAppConfig(appConfig));
  };
}
