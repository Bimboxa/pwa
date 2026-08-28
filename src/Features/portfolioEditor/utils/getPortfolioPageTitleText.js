// Assembles the page title text from a resolved titleFormat (see
// resolveTitleFormat). Defaults reproduce the legacy
// [portfolioName, pageName].join(" · ") output.
export default function getPortfolioPageTitleText(
  resolvedFormat,
  { portfolioName, pageName }
) {
  return [
    resolvedFormat.prefixPortfolioName ? portfolioName : null,
    resolvedFormat.customText || null,
    resolvedFormat.suffixPageName ? pageName : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
