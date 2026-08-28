import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import getPortfolioPageFrameConfig from "../utils/getPortfolioPageFrameConfig";

export default function usePortfolioPageFrame() {
  const appConfig = useAppConfig();
  return getPortfolioPageFrameConfig(appConfig);
}
