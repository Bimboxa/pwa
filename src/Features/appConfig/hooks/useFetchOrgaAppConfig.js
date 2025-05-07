import {useDispatch} from "react-redux";

import {setAppConfig} from "../appConfigSlice";

import fetchOrgaInitAppConfigService from "../services/fetchOrgaInitAppConfig";
import setAppConfigInLocalStorage from "../services/setAppConfigInLocalStorage";
import useToken from "Features/auth/hooks/useToken";

export default function useFetchOrgaAppConfig() {
  const dispatch = useDispatch();
  const accessToken = useToken();

  return async () => {
    const appConfig = await fetchOrgaInitAppConfigService({accessToken});
    setAppConfigInLocalStorage(appConfig);
    dispatch(setAppConfig(appConfig));
  };
}
