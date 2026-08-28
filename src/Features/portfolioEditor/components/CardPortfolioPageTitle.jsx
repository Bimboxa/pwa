import { useDispatch } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";

import { Box, Typography } from "@mui/material";
import { Tune } from "@mui/icons-material";

import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";
import useTitleBlockManifest from "Features/titleBlocks/hooks/useTitleBlockManifest";
import usePortfolioPageFrame from "Features/portfolios/hooks/usePortfolioPageFrame";

import FieldCheck from "Features/form/components/FieldCheck";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

import getPageDimensions from "../utils/getPageDimensions";
import getPageLayout from "../utils/getPageLayout";
import resolveTitleFormat, {
  toPersistedTitleFormat,
} from "../utils/resolveTitleFormat";

// Simplified title section in the page properties panel: show toggle +
// "Voir le détail" button. The detail button selects the title element
// (PORTFOLIO_TITLE), which routes to PanelPortfolioPageTitleProperties.
export default function CardPortfolioPageTitle({ page }) {
  const dispatch = useDispatch();

  // data

  const updateEntity = useUpdateEntity();
  const { value: portfolio } = useDisplayedPortfolio();
  const titleBlockManifest = useTitleBlockManifest(portfolio);
  const pageFrame = usePortfolioPageFrame();

  // helpers

  const isFolioPage = page?.type === "FOLIO_PAGE";
  const pageDims = getPageDimensions(page?.format, page?.orientation);
  const titleBar = isFolioPage
    ? null
    : getPageLayout(
        page?.format,
        page?.orientation,
        0,
        titleBlockManifest.height,
        pageFrame
      ).titleBar;

  const resolved = resolveTitleFormat(page, { titleBar, pageDims, pageFrame });

  // handlers

  async function handleShowChange(checked) {
    if (!page || !portfolio) return;
    await updateEntity(
      page.id,
      { titleFormat: toPersistedTitleFormat(resolved, { show: checked }) },
      { listing: portfolio }
    );
  }

  function handleOpenDetail() {
    dispatch(
      setSelectedItem({
        id: page.id,
        type: "PORTFOLIO_TITLE",
        portfolioId: page.listingId,
      })
    );
  }

  // render

  if (!page) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ pl: 0.5 }}>
        Titre
      </Typography>

      <FieldCheck
        value={resolved.show}
        onChange={handleShowChange}
        label="Afficher le titre"
        options={{ type: "switch", showAsField: true }}
      />

      <ButtonInPanelV2
        label="Voir le détail"
        variant="outlined"
        startIcon={<Tune />}
        onClick={handleOpenDetail}
      />
    </Box>
  );
}
