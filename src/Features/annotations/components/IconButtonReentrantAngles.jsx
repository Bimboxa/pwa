import { useState } from "react";
import { useSelector } from "react-redux";

import useAnnotationTemplates from "../hooks/useAnnotationTemplates";
import useCreateReentrantAngleAnnotations from "../hooks/useCreateReentrantAngleAnnotations";
import useListings from "Features/listings/hooks/useListings";
import { resolveDrawingShape } from "../constants/drawingShapeConfig";

import { IconButton, Menu, Tooltip } from "@mui/material";

import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";
import IconReentrantAngle from "./IconReentrantAngle";

export default function IconButtonReentrantAngles({
  annotations,
  accentColor,
}) {
  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const allTemplates = useAnnotationTemplates({ sortByLabel: true });
  const createReentrantAngles = useCreateReentrantAngleAnnotations();
  const { value: listings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // helpers

  const pointTemplates = allTemplates?.filter(
    (t) => resolveDrawingShape(t) === "POINT"
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
      await createReentrantAngles({ annotations, annotationTemplateId });
    } catch (e) {
      console.error("[reentrantAngles]", e);
    } finally {
      handleClose();
    }
  }

  return (
    <>
      <Tooltip title="Angles rentrants">
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
          <IconReentrantAngle fontSize="small" />
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
          annotationTemplates={pointTemplates}
          listings={listings}
        />
      </Menu>
    </>
  );
}
