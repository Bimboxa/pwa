import useAppConfig from "Features/appConfig/hooks/useAppConfig";

// appConfig.features.assistantRelay:
// { enabled, relayBaseUrl, supabaseUrl, supabaseAnonKey, workspace,
//   maxImageLongEdge, jpegQuality }
export default function useAssistantRelayConfig() {
  const appConfig = useAppConfig();
  return appConfig?.features?.assistantRelay ?? null;
}
