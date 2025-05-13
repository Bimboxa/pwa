import {useDispatch} from "react-redux";

import {setAppConfig} from "../appConfigSlice";

import fetchOrgaInitAppConfigService from "../services/fetchOrgaInitAppConfig";
import setAppConfigInLocalStorage from "../services/setAppConfigInLocalStorage";
import useToken from "Features/auth/hooks/useToken";

import resolveAppConfig from "../utils/resolveAppConfig";
import {useUser} from "@clerk/clerk-react";

export default function useFetchOrgaAppConfig() {
  const dispatch = useDispatch();
  const accessToken = useToken();
  const {user} = useUser();

  // helpers
  const email = user?.primaryEmailAddress?.emailAddress;
  const debug = email === "favreau-consulting@lei.fr";
  console.log("debug", debug, email);

  return async () => {
    let appConfig = await fetchOrgaInitAppConfigService({accessToken});
    appConfig = resolveAppConfig(appConfig, {debug});
    setAppConfigInLocalStorage(appConfig);
    dispatch(setAppConfig(appConfig));
  };
}
