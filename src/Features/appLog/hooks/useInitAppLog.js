import { useEffect, useRef } from "react";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import useLogAppEvent from "./useLogAppEvent";

/**
 * Fires the LOAD_APP event once, as soon as appConfig is available.
 * Called from useInit — must be placed after useInitAppConfig.
 */
export default function useInitAppLog() {
  const appConfig = useAppConfig();
  const logEvent = useLogAppEvent();
  const hasLogged = useRef(false);

  useEffect(() => {
    if (!appConfig || hasLogged.current) return;
    hasLogged.current = true;
    logEvent("LOAD_APP", {});
  }, [appConfig]); // eslint-disable-line react-hooks/exhaustive-deps
}
