import { Box } from "@mui/material";

import SectionConcepts from "./SectionConcepts";
import SectionNavigateApp from "./SectionNavigateApp";
import SectionKeyHints from "./SectionKeyHints";
import SectionGo from "./SectionGo";

// Body of the starting dialog: the section selected in the header band,
// filling the rest of the page (the diagram sections size their SVG to it).
// SectionVideo exists but is not wired for now (see data/startingSections).
export default function PanelStarting({ sectionKey }) {
  // render

  let section = null;
  if (sectionKey === "CONCEPTS") section = <SectionConcepts />;
  else if (sectionKey === "NAVIGATE") section = <SectionNavigateApp />;
  else if (sectionKey === "KEYS") section = <SectionKeyHints />;
  else if (sectionKey === "GO") section = <SectionGo />;

  return (
    <Box
      sx={{
        position: "relative",
        zIndex: 1,
        flexGrow: 1,
        minHeight: 0,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
      }}
    >
      {section}
    </Box>
  );
}
