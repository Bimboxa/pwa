import { useDispatch } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";

import { Box, Typography, Switch, Button } from "@mui/material";
import { ChevronRight } from "@mui/icons-material";

import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useDisplayedPortfolio from "Features/portfolios/hooks/useDisplayedPortfolio";
import usePortfolioPageFrame from "Features/portfolios/hooks/usePortfolioPageFrame";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import getPageDimensions from "../utils/getPageDimensions";
import resolveDetailRefFormat, {
  toPersistedDetailRefFormat,
} from "../utils/resolveDetailRefFormat";

// Simplified detail reference section in the page properties panel (folio
// pages only): show toggle + "Voir le détail" button. The detail button
// selects the reference element (PORTFOLIO_DETAIL_REF), which routes to
// PanelPortfolioPageDetailRefProperties.
export default function CardPortfolioPageDetailRef({ page }) {
  const dispatch = useDispatch();

  // data

  const updateEntity = useUpdateEntity();
  const { value: portfolio } = useDisplayedPortfolio();
  const pageFrame = usePortfolioPageFrame();

  // helpers

  const pageDims = getPageDimensions(page?.format, page?.orientation);
  const resolved = resolveDetailRefFormat(page, { pageDims, pageFrame });

  // handlers

  async function handleShowChange(e, checked) {
    if (!page || !portfolio) return;
    await updateEntity(
      page.id,
      {
        detailRefFormat: toPersistedDetailRefFormat(resolved, {
          show: checked,
        }),
      },
      { listing: portfolio }
    );
  }

  function handleOpenDetail() {
    dispatch(
      setSelectedItem({
        id: page.id,
        type: "PORTFOLIO_DETAIL_REF",
        portfolioId: page.listingId,
      })
    );
  }

  // render

  if (!page) return null;

  return (
    <WhiteSectionGeneric>
      <Typography variant="body2" sx={{ fontWeight: "bold" }}>
        Référence du détail
      </Typography>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          mt: 1,
        }}
      >
        <Typography variant="body2">Afficher la référence</Typography>
        <Switch
          size="small"
          checked={Boolean(resolved.show)}
          onChange={handleShowChange}
        />
      </Box>

      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 0.5 }}>
        <Button
          size="small"
          endIcon={<ChevronRight />}
          onClick={handleOpenDetail}
        >
          Voir le détail
        </Button>
      </Box>
    </WhiteSectionGeneric>
  );
}
