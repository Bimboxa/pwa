import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setAssistantRelayToken } from "../assistantRelaySlice";

import {
  selectRelayToken,
  selectRelayConnectionMode,
} from "../utils/relayConnection.js";

const STORAGE_KEY = "bimboxa-assistantRelay-token";

// Pairing token: kept per tab (sessionStorage) and mirrored in the slice.
// Never persisted in the bundle nor in IndexedDB.
export default function useAssistantRelayToken() {
  const dispatch = useDispatch();
  const token = useSelector(selectRelayToken);
  const mode = useSelector(selectRelayConnectionMode);
  const pairingKey = useSelector((s) => s.assistantRelay.token);

  useEffect(() => {
    if (mode !== "PWA_KEY" || pairingKey) return;
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) dispatch(setAssistantRelayToken(stored));
    } catch {
      // sessionStorage unavailable (private mode…)
    }
  }, [mode, pairingKey, dispatch]);

  const setToken = useCallback(
    (value) => {
      if (mode !== "PWA_KEY") return;
      const trimmed = (value ?? "").trim();
      try {
        if (trimmed) sessionStorage.setItem(STORAGE_KEY, trimmed);
        else sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      dispatch(setAssistantRelayToken(trimmed || null));
    },
    [dispatch, mode]
  );

  return { token, setToken, mode };
}
