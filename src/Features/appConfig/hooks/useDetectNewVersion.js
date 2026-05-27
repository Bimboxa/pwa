import { useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setNewVersionAvailable,
  setNewVersionDialogOpen,
} from "../appConfigSlice";

const POLL_INTERVAL_MS = 12 * 60 * 1000; // 12 minutes
const LAST_SEEN_VERSION_KEY = "appLastSeenVersion";

export default function useDetectNewVersion() {
  const dispatch = useDispatch();
  // Source the bundled version from the resolved appConfig (loaded from the
  // org-specific yaml) — same source the version button displays. Stays
  // undefined until the yaml is loaded, which gates checkVersion below.
  const bundledVersion = useSelector((s) => s.appConfig.value?.appVersion);

  useEffect(() => {
    let cancelled = false;

    async function checkVersion() {
      // Skip until the bundled version is actually resolved — otherwise we'd
      // compare against a placeholder and surface a spurious "new version".
      if (!bundledVersion) return;
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const remote = await res.json();
        if (cancelled) return;
        if (!remote?.version) return;
        if (remote.version === bundledVersion) {
          // Versions match — clear any stale "new version available" flag
          // left over from an earlier dispatch (e.g. the SW listener firing
          // before the yaml resolved, or a previous session).
          dispatch(setNewVersionAvailable(null));
          return;
        }

        dispatch(
          setNewVersionAvailable({
            version: remote.version,
            description: remote.description ?? "",
          })
        );

        const lastSeen = localStorage.getItem(LAST_SEEN_VERSION_KEY);
        if (lastSeen !== remote.version) {
          dispatch(setNewVersionDialogOpen(true));
        }
      } catch (err) {
        console.warn("[useDetectNewVersion] check failed", err);
      }
    }

    checkVersion();

    const intervalId = setInterval(checkVersion, POLL_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        checkVersion();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [bundledVersion, dispatch]);
}
