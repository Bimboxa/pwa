import { useState } from "react";

import { Box, Tab, Tabs } from "@mui/material";

import PanelPovList from "./PanelPovList";
import PanelPovFilters from "./PanelPovFilters";

// POV drawer content: "Vues" (saved views list) / "Filtres" (annotation
// templates visibility) tabs — same tabs idiom as PanelMeshesViewer.
export default function PanelPovDrawer() {
  // state

  const [tab, setTab] = useState("VIEWS");

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
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{
          minHeight: 36,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Tab label="Vues" value="VIEWS" sx={{ minHeight: 36, py: 0.5 }} />
        <Tab label="Filtres" value="FILTERS" sx={{ minHeight: 36, py: 0.5 }} />
      </Tabs>

      {tab === "VIEWS" && <PanelPovList />}
      {tab === "FILTERS" && <PanelPovFilters />}
    </Box>
  );
}
