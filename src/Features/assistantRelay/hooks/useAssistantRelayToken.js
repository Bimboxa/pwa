import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setAssistantRelayToken } from "../assistantRelaySlice";

import {
  selectRelayToken,
  selectRelayConnectionMode,
} from "../utils/relayConnection.js";
import { readPairingKey, writePairingKey } from "../utils/pairingKeyStorage.js";

// Pairing token (Debug / PWA_KEY mode): persisted on the device (see
// pairingKeyStorage) and mirrored in the slice.
export default function useAssistantRelayToken() {
  const dispatch = useDispatch();
  const token = useSelector(selectRelayToken);
  const mode = useSelector(selectRelayConnectionMode);
  const pairingKey = useSelector((s) => s.assistantRelay.token);

  useEffect(() => {
    if (mode !== "PWA_KEY" || pairingKey) return;
    const stored = readPairingKey();
    if (stored) dispatch(setAssistantRelayToken(stored));
  }, [mode, pairingKey, dispatch]);

  const setToken = useCallback(
    (value) => {
      if (mode !== "PWA_KEY") return;
      dispatch(setAssistantRelayToken(writePairingKey(value)));
    },
    [dispatch, mode]
  );

  return { token, setToken, mode };
}
