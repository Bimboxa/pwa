import { useSelector, useDispatch } from "react-redux";

import { setOpenLeftPanel } from "../leftPanelSlice";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import { Box, Paper, IconButton, Tooltip } from "@mui/material";
import { ArrowForwardIos } from "@mui/icons-material";

import BlockListing from "Features/listings/components/BlockListing";

export default function LeftPanelOverviewInEditor() {
  const dispatch = useDispatch();

  // string

  const openS = "Ouvrir le panneau";

  // data

  const { value: listing } = useSelectedListing();
  const open = useSelector((s) => s.leftPanel.openLeftPanel);

  // handlers
  function handleOpenLeftPanel() {
    dispatch(setOpenLeftPanel(true));
  }
  return (
    <Paper
      square
      sx={{
        display: !open ? "flex" : "none",
        alignItems: "center",
        p: 0.5,
        pl: 1,
      }}
    >
      <BlockListing listing={listing} />
      <Tooltip title={openS}>
        <IconButton onClick={handleOpenLeftPanel} size="small" sx={{ ml: 2 }}>
          <ArrowForwardIos />
        </IconButton>
      </Tooltip>
    </Paper>
  );
}
