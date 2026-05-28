import { useState } from "react";
import { useSelector } from "react-redux";

import useAnnotationTemplates from "../hooks/useAnnotationTemplates";
import useListings from "Features/listings/hooks/useListings";
import useCloseEnvelope from "../hooks/useCloseEnvelope";
import { resolveDrawingShape } from "../constants/drawingShapeConfig";

import { CircularProgress, IconButton, Menu, Tooltip } from "@mui/material";

import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";
import IconCloseEnvelope from "Features/icons/IconCloseEnvelope";

export default function IconButtonCloseEnvelope({ annotations, accentColor }) {
  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const allTemplates = useAnnotationTemplates({ sortByLabel: true });
  const closeEnvelope = useCloseEnvelope();
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
    if (!polylineAnnotations?.length) return;
    setLoading(true);
    handleClose();
    try {
      const created = await closeEnvelope({
        annotations: polylineAnnotations,
        annotationTemplateId,
      });
      console.log(`[CloseEnvelope] ${created.length} closing segments created`);
    } catch (e) {
      console.error("[CloseEnvelope]", e);
    } finally {
      setLoading(false);
    }
  }

  // render

  return (
    <>
      <Tooltip title="Fermer l'enveloppe">
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
            {loading ? <CircularProgress size={18} /> : <IconCloseEnvelope fontSize="small" />}
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
