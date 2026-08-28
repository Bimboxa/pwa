// Double page border frame config (appConfig features.portfolios.pageFrame),
// null when the org has none (no frame drawn, legacy HEADER_MARGIN margins).
export default function getPortfolioPageFrameConfig(appConfig) {
  return appConfig?.features?.portfolios?.pageFrame ?? null;
}
