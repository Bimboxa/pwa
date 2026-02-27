import { useDispatch } from "react-redux";

import useSelectedPortfolioPage from "Features/portfolioPages/hooks/useSelectedPortfolioPage";

import { triggerSelectionBack } from "Features/selection/selectionSlice";

import { Box, Typography, IconButton } from "@mui/material";
import { ArrowBack as Back } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import IconButtonMoreActionsPortfolioPage from "./IconButtonMoreActionsPortfolioPage";
import CardPageContent from "./CardPageContent";
import CardPortfolioPageSize from "./CardPortfolioPageSize";
import CardPortfolioPageOrientation from "./CardPortfolioPageOrientation";

import usePortfolioPageContent from "../hooks/usePortfolioPageContent";

export default function PanelPortfolioPageProperties() {
  const dispatch = useDispatch();

  // strings

  const title = "Page";

  // data

  const { value: page } = useSelectedPortfolioPage();
  const content = usePortfolioPageContent(page?.id);

  // helpers

  const label = page?.title ?? "-?-";

  // render

  if (!page) return null;

  return (
    <BoxFlexVStretch>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 0.5,
          pl: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton onClick={() => dispatch(triggerSelectionBack())}>
            <Back />
          </IconButton>

          <Typography variant="body2" sx={{ fontWeight: "bold", ml: 1 }}>
            {label}
          </Typography>
        </Box>

        <IconButtonMoreActionsPortfolioPage page={page} />
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 1.5 }}>
        <CardPageContent content={content} page={page} />
        <CardPortfolioPageSize page={page} />
        <CardPortfolioPageOrientation page={page} />
      </Box>
    </BoxFlexVStretch>
  );
}
