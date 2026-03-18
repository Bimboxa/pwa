import { useState } from "react";
import { useSelector } from "react-redux";

import useAnnotationTemplates from "../hooks/useAnnotationTemplates";
import useExtractStripBoundaries from "../hooks/useExtractStripBoundaries";
import useListings from "Features/listings/hooks/useListings";
import { resolveDrawingShape } from "../constants/drawingShapeConfig";

import { IconButton, Menu, Tooltip } from "@mui/material";

import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";
import IconStripBoundary from "./IconStripBoundary";

export default function IconButtonExtractStripBoundaries({
  annotations,
  accentColor,
}) {
  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const allTemplates = useAnnotationTemplates({ sortByLabel: true });
  const extractBoundaries = useExtractStripBoundaries();
  const { value: listings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // helpers

  const polylineTemplates = allTemplates?.filter(
    (t) => resolveDrawingShape(t) === "POLYLINE"
  );

  // handlers

  function handleOpen(event) {
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  async function handleTemplateChange(annotationTemplateId) {
    try {
      await extractBoundaries({ annotations, annotationTemplateId });
    } catch (e) {
      console.error("[extractStripBoundaries]", e);
    } finally {
      handleClose();
    }
  }

  return (
    <>
      <Tooltip title="Extraire les frontières des bandes">
        <IconButton
          size="small"
          onClick={handleOpen}
          sx={{
            color: "text.disabled",
            "&:hover": {
              color: accentColor,
              bgcolor: accentColor + "18",
            },
          }}
        >
          <IconStripBoundary fontSize="small" />
        </IconButton>
      </Tooltip>

      <Menu
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <SelectorAnnotationTemplateVariantDense
          selectedAnnotationTemplateId={null}
          onChange={handleTemplateChange}
          annotationTemplates={polylineTemplates}
          listings={listings}
        />
      </Menu>
    </>
  );
}
