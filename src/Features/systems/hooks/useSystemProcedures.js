import useAppConfig from "Features/appConfig/hooks/useAppConfig";

const EMPTY = [];

// The system procedures of the registry (appConfig.systemProcedures: the
// SYSTEM_GENERATOR entries of Data/<org>/automatedAnnotationsProcedures, set
// apart by resolveAppConfig).
export default function useSystemProcedures() {
  const appConfig = useAppConfig();
  return appConfig?.systemProcedures ?? EMPTY;
}
