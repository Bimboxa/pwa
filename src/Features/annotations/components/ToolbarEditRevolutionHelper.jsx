import { useState } from "react";

import {
  Box,
  Chip,
  IconButton,
  InputBase,
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
  Height as AxisIcon,
  Adjust as PointIcon,
  Check,
} from "@mui/icons-material";

import stringifyAnnotationData from "../utils/stringifyAnnotationData";
import useSelectedAnnotation from "../hooks/useSelectedAnnotation";
import useUpdateAnnotation from "../hooks/useUpdateAnnotation";
import useRevolutionAxes from "../hooks/useRevolutionAxes";

// Compact edit toolbar for the revolution helpers (REVOLUTION_AXIS /
// REVOLUTION_POINT). These standalone annotations have no template, so the
// full ToolbarEditAnnotation UI does not apply. Instead:
//   - REVOLUTION_AXIS → editable label (default "Axe N")
//   - REVOLUTION_POINT → selector linking the point to an axis (revolutionAxisId)
export default function ToolbarEditRevolutionHelper({ onDragStart }) {
  // data

  const selectedAnnotation = useSelectedAnnotation();
  const updateAnnotation = useUpdateAnnotation();
  const revolutionAxes = useRevolutionAxes();

  // state

  const [labelDraft, setLabelDraft] = useState(null);
  const [axisAnchorEl, setAxisAnchorEl] = useState(null);

  // helpers

  if (!selectedAnnotation) return null;

  const isAxis = selectedAnnotation.type === "REVOLUTION_AXIS";
  const isPoint = selectedAnnotation.type === "REVOLUTION_POINT";

  const currentAxisId = selectedAnnotation.revolutionAxisId ?? null;
  const linkedAxis = revolutionAxes.find((a) => a.id === currentAxisId);

  // handlers

  async function handleLabelCommit() {
    if (labelDraft == null) return;
    await updateAnnotation({ id: selectedAnnotation.id, label: labelDraft });
    setLabelDraft(null);
  }

  async function handleSelectAxis(axisId) {
    await updateAnnotation({
      id: selectedAnnotation.id,
      revolutionAxisId: axisId,
    });
    setAxisAnchorEl(null);
  }

  function handleCopyJson() {
    navigator.clipboard.writeText(stringifyAnnotationData(selectedAnnotation));
  }

  // render

  const Icon = isAxis ? AxisIcon : PointIcon;
  const accentColor =
    selectedAnnotation.strokeColor || selectedAnnotation.fillColor || "#9c27b0";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <Paper elevation={6} sx={{ borderRadius: 3, overflow: "hidden", minWidth: 230 }}>
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
          <Icon sx={{ fontSize: 18, color: accentColor }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {isAxis ? "Axe de révolution" : "Axe (vue en plan)"}
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

        {/* Row 2 - axis label edit OR point->axis selector */}
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
          {isAxis && (
            <>
              <Typography variant="caption" color="text.secondary">
                Nom
              </Typography>
              <InputBase
                value={labelDraft ?? selectedAnnotation.label ?? ""}
                placeholder="Axe"
                onChange={(e) => setLabelDraft(e.target.value)}
                onBlur={handleLabelCommit}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") handleLabelCommit();
                }}
                sx={{
                  flex: 1,
                  fontSize: "0.875rem",
                  px: 1,
                  py: 0.25,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                }}
              />
            </>
          )}

          {isPoint && (
            <>
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
                    <ListItemText>Aucun axe (vue élévation)</ListItemText>
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
            </>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
