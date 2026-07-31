import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  Box,
  Button,
  Chip,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  DragIndicator as GripIcon,
  BugReport as BugReportIcon,
  Adjust as PlacementIcon,
  Place as PlaceIcon,
  Check,
} from "@mui/icons-material";

import theme from "Styles/theme";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import stringifyAnnotationData from "../utils/stringifyAnnotationData";
import useSelectedAnnotation from "../hooks/useSelectedAnnotation";
import useUpdateAnnotation from "../hooks/useUpdateAnnotation";
import useRevolutionAxes from "../hooks/useRevolutionAxes";
import resyncRevolutionAxisPlacementsService from "Features/elevation/services/resyncRevolutionAxisPlacementsService";

const REPOSITION_MODE = "REPOSITION_REVOLUTION_PLACEMENT";

// Compact edit toolbar for a REVOLUTION_AXIS_PLACEMENT — a plan axis dropped on
// a VERTICAL base map. Since that drop is what POSES the base map in 3D,
// "Repositionner" is really "move the base map", and re-linking to another axis
// re-solves the pose too.
export default function ToolbarEditRevolutionAxisPlacement({ onDragStart }) {
  const dispatch = useDispatch();

  // data

  const selectedAnnotation = useSelectedAnnotation();
  const updateAnnotation = useUpdateAnnotation();
  const revolutionAxes = useRevolutionAxes();
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  // state

  const [axisAnchorEl, setAxisAnchorEl] = useState(null);

  // helpers

  if (!selectedAnnotation) return null;

  const accentColor =
    selectedAnnotation.strokeColor || theme.palette.secondary.main;
  const currentAxisId = selectedAnnotation.revolutionAxisId ?? null;
  const linkedAxis = revolutionAxes.find((a) => a.id === currentAxisId);
  const isRepositioning = enabledDrawingMode === REPOSITION_MODE;

  // handlers

  async function handleSelectAxis(axisId) {
    setAxisAnchorEl(null);
    await updateAnnotation({
      id: selectedAnnotation.id,
      revolutionAxisId: axisId,
    });
    await resyncRevolutionAxisPlacementsService({
      placementId: selectedAnnotation.id,
      dispatch,
    });
  }

  function handleToggleReposition() {
    dispatch(setEnabledDrawingMode(isRepositioning ? null : REPOSITION_MODE));
  }

  function handleCopyJson() {
    navigator.clipboard.writeText(stringifyAnnotationData(selectedAnnotation));
  }

  // render

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <Paper
        elevation={6}
        sx={{ borderRadius: 3, overflow: "hidden", minWidth: 260 }}
      >
        {/* Row 1 - identity (draggable) */}
        <Box
          onMouseDown={onDragStart}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            px: 1.25,
            py: 0.75,
            cursor: "grab",
            borderLeft: "4px solid",
            borderColor: accentColor,
          }}
        >
          <GripIcon sx={{ fontSize: 16, color: "text.disabled" }} />
          <PlacementIcon sx={{ fontSize: 18, color: accentColor }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {"Position de l'axe"}
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Copy annotation data" arrow>
            <IconButton
              size="small"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={handleCopyJson}
              sx={{
                color: "text.disabled",
                opacity: 0.4,
                "&:hover": { opacity: 1, bgcolor: "action.hover" },
              }}
            >
              <BugReportIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Row 2 - linked axis */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.25,
            py: 0.75,
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Axe lié
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            label={linkedAxis?.label ?? "Choisir un axe"}
            onClick={(e) => setAxisAnchorEl(e.currentTarget)}
            sx={{ height: 24, fontSize: "0.75rem", cursor: "pointer" }}
          />
          <Menu
            open={Boolean(axisAnchorEl)}
            anchorEl={axisAnchorEl}
            onClose={() => setAxisAnchorEl(null)}
          >
            {revolutionAxes.length === 0 && (
              <MenuItem disabled dense>
                <ListItemText>Aucun axe (vue en plan)</ListItemText>
              </MenuItem>
            )}
            {revolutionAxes.map((axe) => (
              <MenuItem
                key={axe.id}
                onClick={() => handleSelectAxis(axe.id)}
                dense
              >
                {currentAxisId === axe.id && (
                  <ListItemIcon>
                    <Check fontSize="small" />
                  </ListItemIcon>
                )}
                <ListItemText inset={currentAxisId !== axe.id}>
                  {axe.label ?? "Axe"}
                </ListItemText>
              </MenuItem>
            ))}
          </Menu>
        </Box>

        {/* Row 3 - reposition */}
        <Box
          sx={{
            px: 1.25,
            py: 0.75,
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Button
            fullWidth
            size="small"
            startIcon={<PlaceIcon />}
            variant={isRepositioning ? "contained" : "outlined"}
            onClick={handleToggleReposition}
            sx={{ textTransform: "none" }}
          >
            Repositionner
          </Button>
          {isRepositioning && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 0.5, textAlign: "center" }}
            >
              {"Cliquez sur l'élévation pour déplacer l'axe."}
            </Typography>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
