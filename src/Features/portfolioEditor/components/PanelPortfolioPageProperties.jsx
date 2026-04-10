import { useState } from "react";
import { useDispatch } from "react-redux";

import useSelectedPortfolioPage from "Features/portfolioPages/hooks/useSelectedPortfolioPage";

import { triggerSelectionBack } from "Features/selection/selectionSlice";

import { Box, Typography, IconButton, CircularProgress } from "@mui/material";
import { ArrowBack as Back, ContentCopy } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import FieldCheck from "Features/form/components/FieldCheck";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import IconButtonMoreActionsPortfolioPage from "./IconButtonMoreActionsPortfolioPage";
import CardPageContent from "./CardPageContent";
import CardPortfolioPageSize from "./CardPortfolioPageSize";
import CardPortfolioPageOrientation from "./CardPortfolioPageOrientation";

import usePortfolioPageContent from "../hooks/usePortfolioPageContent";
import copyPageAsPng from "../utils/copyPageAsPng";

export default function PanelPortfolioPageProperties() {
  const dispatch = useDispatch();

  // strings

  const title = "Page";

  // data

  const { value: page } = useSelectedPortfolioPage();
  const content = usePortfolioPageContent(page?.id);

  // state

  const [includeCartouche, setIncludeCartouche] = useState(false);
  const [loading, setLoading] = useState(false);

  // helpers

  const label = page?.title ?? "-?-";

  // handlers

  async function handleCopyPage() {
    setLoading(true);
    try {
      await copyPageAsPng(page.id, { includeCartouche });
    } catch (err) {
      console.error("Failed to copy page as PNG:", err);
    } finally {
      setLoading(false);
    }
  }

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

          <Box sx={{ ml: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Page
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              {label}
            </Typography>
          </Box>
        </Box>

        <IconButtonMoreActionsPortfolioPage page={page} />
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 1.5 }}>
        <CardPageContent content={content} page={page} />
        <CardPortfolioPageSize page={page} />
        <CardPortfolioPageOrientation page={page} />

        <WhiteSectionGeneric>
          <ButtonInPanelV2
            label="Copier la page"
            variant="outlined"
            startIcon={
              loading ? <CircularProgress size={20} /> : <ContentCopy />
            }
            disabled={loading}
            onClick={handleCopyPage}
          />
          <FieldCheck
            value={includeCartouche}
            onChange={setIncludeCartouche}
            label="Inclure le cartouche"
            options={{ showAsInline: true }}
          />
        </WhiteSectionGeneric>
      </Box>
    </BoxFlexVStretch>
  );
}
