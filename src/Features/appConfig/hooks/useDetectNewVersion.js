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
  const bundledVersion = useSelector((s) => s.appConfig.appVersion);

  useEffect(() => {
    let cancelled = false;

    async function checkVersion() {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const remote = await res.json();
        if (cancelled) return;
        if (!remote?.version || remote.version === bundledVersion) return;

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
