import { useState } from "react";

import { Box, Typography, Button } from "@mui/material";
import { TableChart } from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import DatagridAnnotations from "Features/annotations/components/DatagridAnnotations";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionAnnotationTemplateQties from "./SectionAnnotationTemplateQties";
import SectionBusinessObjectQties from "./SectionBusinessObjectQties";

// Totals of the SCOPE module recap, above the per-base-map sections: the same
// two-column layout as a base map row, with "Total" standing in for the plan
// and the quantities of the whole listing on the right (see
// MainListingMapsEditor for the mode table).
export default function SectionCrossBaseMaps({
  listing,
  showAllListings,
  isBaseMapListing,
  isBusinessObjectListing,
  annotations,
  annotationTemplates,
  businessObjects,
  businessObjectRels,
}) {
  // strings

  const allListingsS = "Tous les objets";
  const totalS = "Total";
  const seeDataS = "Voir les données";

  // state

  const [openDialog, setOpenDialog] = useState(false);

  // helpers

  // Still the dialog's title — the header itself only says "Total".
  const title = showAllListings ? allListingsS : listing?.name;

  // handlers

  function handleOpenDialog() {
    setOpenDialog(true);
  }

  function handleCloseDialog() {
    setOpenDialog(false);
  }

  // render

  return (
    <Box sx={{ display: "flex", gap: 2, width: 1 }}>
      {/* Left column — "Total" in place of the base map, so the totals line
          up with the per-base-map rows below. */}
      <Box
        sx={{
          width: "40%",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 1,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: "bold" }}>
          {totalS}
        </Typography>
        <Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<TableChart />}
            onClick={handleOpenDialog}
          >
            {seeDataS}
          </Button>
        </Box>
      </Box>

      {/* Right column — quantities, driven by the listing type. A base map
          listing carries none: the section stays empty. */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          pl: "24px",
          pr: "24px",
        }}
      >
        {isBaseMapListing ? null : isBusinessObjectListing ? (
          <SectionBusinessObjectQties
            businessObjects={businessObjects}
            rels={businessObjectRels}
            annotations={annotations}
          />
        ) : (
          <SectionAnnotationTemplateQties
            annotations={annotations}
            annotationTemplates={annotationTemplates}
            groupByListing={showAllListings}
          />
        )}
      </Box>

      {/* Dialog with DataGrid */}
      <DialogGeneric
        title={title}
        open={openDialog}
        onClose={handleCloseDialog}
        vw="90"
        vh="80"
      >
        <BoxFlexVStretch>
          <DatagridAnnotations
            annotations={annotations}
            showListingName={showAllListings}
            onClose={handleCloseDialog}
          />
        </BoxFlexVStretch>
      </DialogGeneric>
    </Box>
  );
}
