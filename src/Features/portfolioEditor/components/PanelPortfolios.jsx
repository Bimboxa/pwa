import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setDisplayedPortfolioId } from "Features/portfolios/portfoliosSlice";

import { Box, IconButton, Tooltip } from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";

import LeftDrawerPanelHeader from "Features/leftPanel/components/LeftDrawerPanelHeader";
import PortfolioTree from "./PortfolioTree";
import DialogCreatePortfolio from "./DialogCreatePortfolio";

import useCreatePortfolio from "Features/portfolios/hooks/useCreatePortfolio";
import useCreateDetailsPortfolio from "Features/portfolios/hooks/useCreateDetailsPortfolio";

// ---------------------------------------------------------------------------
// PanelPortfolios — left panel of the Carnet de plans module: header with a
// "+" button opening the portfolio creation dialog, above the portfolios /
// pages tree — same layout pattern as PanelBaseMaps (#312).
// ---------------------------------------------------------------------------

export default function PanelPortfolios() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Carnets";
  const newPortfolioS = "Nouveau carnet de plans";

  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const createPortfolio = useCreatePortfolio();
  const createDetailsPortfolio = useCreateDetailsPortfolio();

  // state

  const [openDialog, setOpenDialog] = useState(false);

  // handlers

  async function handleCreate({
    title,
    isDetailsPortfolio,
    selectedDetails,
    titleBlock,
  }) {
    const metadata = titleBlock ? { titleBlock } : undefined;
    let portfolio;
    if (isDetailsPortfolio) {
      portfolio = await createDetailsPortfolio({
        scopeId,
        projectId,
        title,
        details: selectedDetails,
        metadata,
      });
    } else {
      portfolio = await createPortfolio({
        scopeId,
        projectId,
        title,
        metadata,
      });
    }
    dispatch(setDisplayedPortfolioId(portfolio.id));
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: 1,
        minHeight: 0,
        bgcolor: "background.default",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pr: 1,
        }}
      >
        <LeftDrawerPanelHeader title={titleS} />
        <Tooltip title={newPortfolioS}>
          <IconButton
            size="small"
            color="secondary"
            onClick={() => setOpenDialog(true)}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <PortfolioTree />
      </Box>

      <DialogCreatePortfolio
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onCreate={handleCreate}
      />
    </Box>
  );
}
