import { useSelector } from "react-redux";

import { CircularProgress } from "@mui/material";
import { PictureAsPdf } from "@mui/icons-material";

import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";
import usePortfolioPages from "Features/portfolioPages/hooks/usePortfolioPages";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import usePortfolioLogoUrl from "Features/portfolios/hooks/usePortfolioLogoUrl";

import useDownloadPortfolioPdf from "../hooks/useDownloadPortfolioPdf";

export default function ButtonDownloadPortfolioPdf({ hdExport }) {
  // data

  const displayedPortfolioId = useSelector(
    (s) => s.portfolios.displayedPortfolioId
  );
  const { value: portfolio } = useDisplayedPortfolio();
  const { value: project } = useSelectedProject();
  const { value: pages } = usePortfolioPages({
    filterByPortfolioId: displayedPortfolioId,
  });
  const spriteImage = useAnnotationSpriteImage();
  const portfolioLogoUrl = usePortfolioLogoUrl(portfolio?.metadata?.logo);
  const { download, loading } = useDownloadPortfolioPdf();

  // handlers

  function handleClick() {
    download({ portfolio, project, pages, spriteImage, portfolioLogoUrl, hdExport });
  }

  // render

  if (!displayedPortfolioId || !pages?.length) return null;

  return (
    <ButtonInPanelV2
      label={loading ? "Export..." : "Telecharger PDF"}
      variant="contained"
      color="secondary"
      size="small"
      startIcon={loading ? <CircularProgress size={16} /> : <PictureAsPdf />}
      onClick={handleClick}
      disabled={loading}
    />
  );
}
