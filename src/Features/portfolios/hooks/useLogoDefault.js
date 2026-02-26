import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function useLogoDefault() {
  const appConfig = useAppConfig();
  return appConfig?.features?.portfolios?.logoDefault;
}
