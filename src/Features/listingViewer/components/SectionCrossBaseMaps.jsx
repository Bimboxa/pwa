import { useState } from "react";

import { Box, Typography, Button } from "@mui/material";
import { TableChart } from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import DatagridAnnotations from "Features/annotations/components/DatagridAnnotations";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionAnnotationTemplateQties from "./SectionAnnotationTemplateQties";
import SectionBusinessObjectQties from "./SectionBusinessObjectQties";

// Totals of the SCOPE module recap, above the per-base-map sections: the
// listing name and its annotation count on the left, the quantities of the
// whole listing on the right (see MainListingMapsEditor for the mode table).
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
  const annotationsS = "annotations";
  const seeDataS = "Voir les données";

  // state

  const [openDialog, setOpenDialog] = useState(false);

  // helpers

  const title = showAllListings ? allListingsS : listing?.name;
  const annotationCount = annotations?.length ?? 0;

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
      {/* Left column */}
      <Box
        sx={{
          width: "40%",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: "bold", mb: 1 }}>
          {title}
        </Typography>
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
          }}
        >
          <Typography variant="h3" sx={{ fontWeight: "bold" }}>
            {annotationCount}
            <Typography
              component="span"
              variant="subtitle1"
              color="text.secondary"
              sx={{ ml: 1 }}
            >
              {annotationsS}
            </Typography>
          </Typography>
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
