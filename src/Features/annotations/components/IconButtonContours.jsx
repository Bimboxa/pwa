import { useState } from "react";
import { useSelector } from "react-redux";

import useAnnotationTemplates from "../hooks/useAnnotationTemplates";
import useListings from "Features/listings/hooks/useListings";
import useWallBoundaries from "Features/smartDetect/hooks/useWallBoundaries";
import { resolveDrawingShape } from "../constants/drawingShapeConfig";

import { CircularProgress, IconButton, Menu, Tooltip } from "@mui/material";

import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";
import IconContours from "Features/icons/IconContours";

export default function IconButtonContours({ annotations, accentColor }) {
  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const allTemplates = useAnnotationTemplates({ sortByLabel: true });
  const computeBoundaries = useWallBoundaries();
  const { value: listings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);
  const open = Boolean(anchorEl);

  // helpers

  const polylineTemplates = allTemplates?.filter(
    (t) => resolveDrawingShape(t) === "POLYLINE"
  );

  const polylineAnnotations = annotations?.filter((a) => a.type === "POLYLINE");

  // handlers

  function handleOpen(event) { setAnchorEl(event.currentTarget); }
  function handleClose() { setAnchorEl(null); }

  async function handleTemplateChange(annotationTemplateId) {
    const template = allTemplates?.find((t) => t.id === annotationTemplateId);
    if (!template || !polylineAnnotations?.length) return;
    setLoading(true);
    handleClose();
    try {
      const result = await computeBoundaries({
        wallAnnotations: polylineAnnotations,
        boundaryAnnotationTemplate: template,
      });
      console.log(`[Contours] ${result.count} boundary annotations created`);
    } catch (e) {
      console.error("[Contours]", e);
    } finally {
      setLoading(false);
    }
  }

  // render

  return (
    <>
      <Tooltip title="Contours">
        <span>
          <IconButton
            size="small"
            onClick={handleOpen}
            disabled={loading || !polylineAnnotations?.length}
            sx={{
              color: "text.disabled",
              "&:hover": { color: accentColor, bgcolor: accentColor + "18" },
            }}
          >
            {loading ? <CircularProgress size={18} /> : <IconContours fontSize="small" />}
          </IconButton>
        </span>
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
