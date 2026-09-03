import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function useNotesAppConfig() {
  const appConfig = useAppConfig();
  return appConfig?.features?.notesApp ?? null;
}
