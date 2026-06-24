import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import useLogAppEvent from "./useLogAppEvent";

// Fallback delay: if no user identity ever resolves, still fire LOAD_APP so the
// log isn't lost (it goes out with an empty userName).
const AUTH_WAIT_TIMEOUT_MS = 8000;

/**
 * Fires the LOAD_APP event once.
 *
 * Waits for both `appConfig` and a resolved user identity in Redux (trigram OR
 * firstName/lastName) so the log carries a usable `userName`. This is
 * intentionally tied to the auth *state* rather than a specific auth flow:
 * the active service varies (PHONE_NUMBER, Kerberos autoAuth, …) and they
 * populate `userProfile` at different moments — gating on the resolved profile
 * works regardless of which one filled it.
 *
 * `logEvent` is recreated on every render, so when the identity appears the
 * effect re-runs with a fresh closure and reads the up-to-date profile.
 *
 * Called from useInit — must be placed after useInitAppConfig.
 */
export default function useInitAppLog() {
  const appConfig = useAppConfig();
  const hasIdentity = useSelector((s) => {
    const p = s.auth.userProfile;
    return Boolean(p?.trigram || p?.firstName || p?.lastName);
  });
  const logEvent = useLogAppEvent();
  const hasLogged = useRef(false);

  useEffect(() => {
    if (!appConfig || hasLogged.current) return;

    // Identity resolved => log immediately with a populated userName.
    if (hasIdentity) {
      hasLogged.current = true;
      logEvent("LOAD_APP", {});
      return;
    }

    // Not resolved yet => wait, but don't block the log forever.
    const timeoutId = setTimeout(() => {
      if (hasLogged.current) return;
      hasLogged.current = true;
      logEvent("LOAD_APP", {});
    }, AUTH_WAIT_TIMEOUT_MS);

    return () => clearTimeout(timeoutId);
  }, [appConfig, hasIdentity]); // eslint-disable-line react-hooks/exhaustive-deps
}
