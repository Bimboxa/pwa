import { useState } from "react";
import { useDispatch } from "react-redux";

import {
  Box,
  IconButton,
  InputBase,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  DragIndicator as GripIcon,
  BugReport as BugReportIcon,
  RotateRight as AxisIcon,
  Flip as FlipIcon,
  DonutLarge as PartialIcon,
  Lens as TotalIcon,
} from "@mui/icons-material";

import theme from "Styles/theme";

import stringifyAnnotationData from "../utils/stringifyAnnotationData";
import useSelectedAnnotation from "../hooks/useSelectedAnnotation";
import useUpdateAnnotation from "../hooks/useUpdateAnnotation";
import FieldAnnotationHeight from "./FieldAnnotationHeight";
import resyncRevolutionAxisPlacementsService from "Features/elevation/services/resyncRevolutionAxisPlacementsService";

// Compact edit toolbar for a plan-view REVOLUTION_AXIS. Standalone annotation
// (no template), so the template-centric ToolbarEditAnnotation does not apply.
//
// `invertHalf` and `offsetZ` both change the pose of every vertical base map
// this axis places, so they run the resync service after writing.
const DEFAULT_ANGLE_START_DEG = 0;
const DEFAULT_ANGLE_END_DEG = 180;

export default function ToolbarEditRevolutionAxis({ onDragStart }) {
  const dispatch = useDispatch();

  // data

  const selectedAnnotation = useSelectedAnnotation();
  const updateAnnotation = useUpdateAnnotation();

  // state

  const [labelDraft, setLabelDraft] = useState(null);

  // helpers

  if (!selectedAnnotation) return null;

  const accentColor =
    selectedAnnotation.strokeColor || theme.palette.secondary.main;
  const isPartial = Boolean(selectedAnnotation.partialRevolution);

  // handlers

  async function handleLabelCommit() {
    if (labelDraft == null) return;
    await updateAnnotation({ id: selectedAnnotation.id, label: labelDraft });
    setLabelDraft(null);
  }

  async function handleToggleInvertHalf() {
    await updateAnnotation({
      id: selectedAnnotation.id,
      invertHalf: !selectedAnnotation.invertHalf,
    });
    await resyncRevolutionAxisPlacementsService({
      axisId: selectedAnnotation.id,
      dispatch,
    });
  }

  async function handleTogglePartial() {
    const next = !isPartial;
    const updates = { id: selectedAnnotation.id, partialRevolution: next };
    if (next && selectedAnnotation.revolutionAngleStartDeg == null) {
      updates.revolutionAngleStartDeg = DEFAULT_ANGLE_START_DEG;
      updates.revolutionAngleEndDeg = DEFAULT_ANGLE_END_DEG;
    }
    await updateAnnotation(updates);
  }

  // FieldAnnotationHeight echoes back the WHOLE annotation with one field
  // replaced, so pick the field explicitly rather than spreading.
  async function handleHeightChange(next) {
    await updateAnnotation({
      id: selectedAnnotation.id,
      height: next?.height ?? null,
    });
  }

  // The radius is graphical only (circle + diameter size): it never moves the
  // elevations this axis places, so no pose resync here.
  async function handleRadiusChange(next) {
    await updateAnnotation({
      id: selectedAnnotation.id,
      radiusM: next?.radiusM ?? null,
    });
  }

  async function handleOffsetZChange(next) {
    await updateAnnotation({
      id: selectedAnnotation.id,
      offsetZ: next?.offsetZ ?? null,
    });
    // offsetZ is the absolute Z of the axis centre → it moves every elevation
    // this axis places. (`height` is drawing-only.)
    await resyncRevolutionAxisPlacementsService({
      axisId: selectedAnnotation.id,
      dispatch,
    });
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
          <AxisIcon sx={{ fontSize: 18, color: accentColor }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Axe de révolution
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

        {/* Row 2 - name */}
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
        </Box>

        {/* Row 3 - height (drawing) + offset Z (drives the elevation pose) */}
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
          <FieldAnnotationHeight
            annotation={selectedAnnotation}
            field="radiusM"
            label="rayon"
            onChange={handleRadiusChange}
          />
          <FieldAnnotationHeight
            annotation={selectedAnnotation}
            field="height"
            label="ht."
            onChange={handleHeightChange}
          />
          <FieldAnnotationHeight
            annotation={selectedAnnotation}
            field="offsetZ"
            label="off."
            onChange={handleOffsetZChange}
          />
        </Box>

        {/* Row 4 - actions */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            px: 1.25,
            py: 0.5,
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Tooltip title="Inverser les demi-révolutions" arrow>
            <IconButton
              size="small"
              onClick={handleToggleInvertHalf}
              sx={{
                color: selectedAnnotation.invertHalf
                  ? accentColor
                  : "text.disabled",
                bgcolor: selectedAnnotation.invertHalf
                  ? accentColor + "18"
                  : "transparent",
                "&:hover": { color: accentColor, bgcolor: accentColor + "18" },
              }}
            >
              <FlipIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip
            title={isPartial ? "Révolution totale" : "Révolution partielle"}
            arrow
          >
            <IconButton
              size="small"
              onClick={handleTogglePartial}
              sx={{
                color: isPartial ? accentColor : "text.disabled",
                bgcolor: isPartial ? accentColor + "18" : "transparent",
                "&:hover": { color: accentColor, bgcolor: accentColor + "18" },
              }}
            >
              {isPartial ? (
                <PartialIcon fontSize="small" />
              ) : (
                <TotalIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>
    </Box>
  );
}
