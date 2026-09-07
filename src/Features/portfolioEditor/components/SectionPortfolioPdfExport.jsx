import { useState } from "react";

import { Box, Typography, FormControlLabel, Checkbox } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import ButtonDownloadPortfolioPdf from "./ButtonDownloadPortfolioPdf";

// "Carnet de plans" card of the Export tool — module PORTFOLIO only (the gate
// lives in PanelPrint): PDF download of the displayed portfolio, with the
// optional high-definition capture of the plan pages.
export default function SectionPortfolioPdfExport() {
  // strings

  const titleS = "Carnet de plans";
  const hdS = "Haute définition";

  // state

  const [hdExport, setHdExport] = useState(false);

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {titleS}
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={hdExport}
              onChange={(e) => setHdExport(e.target.checked)}
            />
          }
          label={hdS}
          slotProps={{ typography: { variant: "body2" } }}
        />
        <ButtonDownloadPortfolioPdf hdExport={hdExport} />
      </Box>
    </WhiteSectionGeneric>
  );
}
