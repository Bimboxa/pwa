import { useSelector } from "react-redux";

import { Button, CircularProgress } from "@mui/material";
import { PictureAsPdf } from "@mui/icons-material";

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
    <Button
      size="small"
      variant="outlined"
      startIcon={loading ? <CircularProgress size={16} /> : <PictureAsPdf />}
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? "Export..." : "Telecharger PDF"}
    </Button>
  );
}
