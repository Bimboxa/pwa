import { useState } from "react";
import { useDispatch } from "react-redux";

import { setSelectedListingId } from "Features/listings/listingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import { Box, Tooltip } from "@mui/material";
import ArrowDropDown from "@mui/icons-material/ArrowDropDown";

import ToolPickerMenu from "Features/mapEditor/components/ToolPickerMenu";
import useDrawFromTemplate from "Features/mapEditor/hooks/useDrawFromTemplate";

// ---------------------------------------------------------------------------
// SplitButtonStartDraw — dark split button of a template row: the left segment
// shows the active tool and starts drawing, the right arrow opens the tool
// picker (other tools of the template's drawing shape + "Éditer le modèle").
// ---------------------------------------------------------------------------

const segmentSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  bgcolor: "transparent",
  color: "common.white",
  cursor: "pointer",
  p: 0,
  "&:disabled": { cursor: "default", color: "grey.500" },
};

export default function SplitButtonStartDraw({
  annotationTemplate,
  listingId,
}) {
  const dispatch = useDispatch();

  // data

  const {
    activeTool,
    hasFixedTool,
    canDrawInCurrentEditor,
    startDraw,
    selectToolAndDraw,
  } = useDrawFromTemplate(annotationTemplate, listingId);

  // state

  const [toolMenuAnchor, setToolMenuAnchor] = useState(null);

  // helpers

  const ActiveToolIcon = activeTool?.Icon;
  const disabled = !canDrawInCurrentEditor;

  // handlers

  const handleDrawClick = (e) => {
    e.stopPropagation();
    startDraw();
  };

  const handleArrowClick = (e) => {
    e.stopPropagation();
    setToolMenuAnchor(e.currentTarget);
  };

  const handleEditTemplate = () => {
    dispatch(setSelectedListingId(listingId));
    dispatch(
      setSelectedItem({
        id: annotationTemplate?.id,
        type: "ANNOTATION_TEMPLATE",
      })
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  };

  // render

  if (!ActiveToolIcon) return null;

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "stretch",
          height: 32,
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: disabled ? "action.disabledBackground" : "grey.900",
          flexShrink: 0,
        }}
      >
        <Tooltip
          title={
            disabled
              ? "Indisponible dans l'éditeur 3D"
              : `Dessiner — ${activeTool?.label ?? ""}`
          }
          arrow
        >
          {/* span keeps the tooltip working on the disabled button */}
          <Box component="span" sx={{ display: "flex" }}>
            <Box
              component="button"
              onClick={handleDrawClick}
              disabled={disabled}
              sx={{
                ...segmentSx,
                width: 36,
                "&:hover": { bgcolor: disabled ? "transparent" : "grey.700" },
              }}
            >
              <ActiveToolIcon sx={{ fontSize: 18 }} />
            </Box>
          </Box>
        </Tooltip>
        {/* REVOLUTION_AXIS: single fixed tool — no picker segment. */}
        {!hasFixedTool && (
          <Tooltip title="Changer d'outil" arrow>
            <Box
              component="button"
              onClick={handleArrowClick}
              sx={{
                ...segmentSx,
                width: 20,
                borderLeft: "1px solid",
                borderColor: "rgba(255,255,255,0.25)",
                "&:hover": { bgcolor: "grey.700" },
              }}
            >
              <ArrowDropDown sx={{ fontSize: 16 }} />
            </Box>
          </Tooltip>
        )}
      </Box>

      <ToolPickerMenu
        anchorEl={toolMenuAnchor}
        open={Boolean(toolMenuAnchor)}
        onClose={() => setToolMenuAnchor(null)}
        annotationTemplate={annotationTemplate}
        onSelectTool={selectToolAndDraw}
        onEdit={handleEditTemplate}
      />
    </>
  );
}
