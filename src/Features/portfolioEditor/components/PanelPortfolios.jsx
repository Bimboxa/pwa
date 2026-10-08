import { useState } from "react";

import { Box, IconButton, Tooltip } from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";

import LeftDrawerPanelHeader from "Features/leftPanel/components/LeftDrawerPanelHeader";
import PortfolioTree from "./PortfolioTree";
import DialogCreatePortfolio from "./DialogCreatePortfolio";

import useCreatePortfolioFromDialog from "Features/portfolios/hooks/useCreatePortfolioFromDialog";

// ---------------------------------------------------------------------------
// PanelPortfolios — left panel of the Carnet de plans module: header with a
// "+" button opening the portfolio creation dialog, above the portfolios /
// pages tree — same layout pattern as PanelBaseMaps (#312).
// ---------------------------------------------------------------------------

export default function PanelPortfolios() {
  // strings

  const titleS = "Carnets";
  const newPortfolioS = "Nouveau carnet de plans";

  // data

  const createFromDialog = useCreatePortfolioFromDialog();

  // state

  const [openDialog, setOpenDialog] = useState(false);

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
        <PortfolioTree onCreateClick={() => setOpenDialog(true)} />
      </Box>

      <DialogCreatePortfolio
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        onCreate={createFromDialog}
      />
    </Box>
  );
}
