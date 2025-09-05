import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import PanelListingContainer from "Features/listings/components/PanelListingContainer";

export default function LeftPanel() {
  // data

  const openLeftPanel = useSelector((s) => s.leftPanel.openLeftPanel);
  const panelWidth = useSelector((s) => s.leftPanel.width);

  // helpers

  const width = openLeftPanel ? panelWidth : 0;

  // render

  return (
    <Box
      sx={{
        width,
        borderRight: "1px solid #ccc",
      }}
    >
      <PanelListingContainer />
    </Box>
  );
}
