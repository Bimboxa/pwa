import { useSelector } from "react-redux";

import { CircularProgress } from "@mui/material";
import { PictureAsPdf } from "@mui/icons-material";

import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";
import usePortfolioPages from "Features/portfolioPages/hooks/usePortfolioPages";

import useDownloadPortfolioPdf from "../hooks/useDownloadPortfolioPdf";

export default function ButtonDownloadPortfolioPdf() {
  // data

  const displayedPortfolioId = useSelector(
    (s) => s.portfolios.displayedPortfolioId
  );
  const { value: portfolio } = useDisplayedPortfolio();
  const { value: pages } = usePortfolioPages({
    filterByPortfolioId: displayedPortfolioId,
  });
  const { download, loading } = useDownloadPortfolioPdf();

  // handlers

  function handleClick() {
    download({ portfolio, pages });
  }

  // render

  if (!displayedPortfolioId || !pages?.length) return null;

  return (
    <ButtonInPanelV2
      label={loading ? "Export..." : "Telecharger PDF"}
      variant="outlined"
      size="small"
      startIcon={loading ? <CircularProgress size={16} /> : <PictureAsPdf />}
      onClick={handleClick}
      disabled={loading}
    />
  );
}
