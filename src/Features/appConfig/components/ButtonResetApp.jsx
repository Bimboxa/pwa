import {useState, useEffect} from "react";

import {useDispatch} from "react-redux";

import {setAppConfig} from "../appConfigSlice";

import useToken from "Features/auth/hooks/useToken";

import ButtonInPanel from "Features/layout/components/ButtonInPanel";

import fetchOrgaInitAppConfigService from "../services/fetchOrgaInitAppConfig";

export default function ButtonResetApp() {
  const dispatch = useDispatch();
  const accessToken = useToken();

  // string

  const resetS = "Réinitialiser l'application";

  // state

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      setLoading(false);
    };
  }, []);

  // handlers

  async function handleReset() {
    setLoading(true);
    const appConfig = await fetchOrgaInitAppConfigService({accessToken});
    console.log("[ButtonResetApp] appConfig", appConfig);
    dispatch(setAppConfig(appConfig));
    setLoading(false);
  }

  return (
    <ButtonInPanel label={resetS} onClick={handleReset} loading={loading} />
  );
}
