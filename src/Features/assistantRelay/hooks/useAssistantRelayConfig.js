import { useMemo } from "react";
import { useSelector } from "react-redux";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import { selectRelayBaseUrl } from "../utils/relayConnection.js";

// All relay consumers use the Chat tool's effective endpoint. Legacy
// organizations without chat.connection keep assistantRelay.relayBaseUrl.
export default function useAssistantRelayConfig() {
  const appConfig = useAppConfig();
  const relay = appConfig?.features?.assistantRelay;
  const relayBaseUrl = useSelector(selectRelayBaseUrl);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const synced = useSelector((s) => s.scopeConfig.synced);
  return useMemo(
    () =>
      relay
        ? {
            ...relay,
            relayBaseUrl,
            enabled: relay.enabled && (!scopeId || synced),
          }
        : null,
    [relay, relayBaseUrl, scopeId, synced]
  );
}
