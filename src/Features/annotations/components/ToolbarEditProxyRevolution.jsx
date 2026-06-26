import { useState } from "react";

import {
  Box,
  Button,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  DragIndicator as GripIcon,
  ThreeDRotation as ThreeDRotationIcon,
  PieChartOutline as PartialIcon,
  DonutLarge as TotalIcon,
} from "@mui/icons-material";

import db from "App/db/db";

import useSelectedAnnotation from "../hooks/useSelectedAnnotation";
import useUpdateAnnotation from "../hooks/useUpdateAnnotation";
import useHasThreedViewerPeer from "Features/threedEditor/hooks/useHasThreedViewerPeer";
import useNavigateThreedCameraToAnnotation from "Features/threedEditor/hooks/useNavigateThreedCameraToAnnotation";

import AnnotationTemplateIcon from "./AnnotationTemplateIcon";
import AnnotationMeasurements from "./AnnotationMeasurements";

// Default opening when first switching to partial revolution: a 270° wedge with
// the "mouth" pointing right (+x). Angles are plan-view radians (y-down frame).
const DEFAULT_ANGLE_START = Math.PI / 4;
const DEFAULT_ANGLE_END = (7 * Math.PI) / 4;

// Compact toolbar shown when a revolution proxy ("donut") is selected. It drops
// the height/offset fields and the full action bar, keeping only:
//   - Row 1: source-arc template (label + icon),
//   - Row 3: the revolved surface (inherited, partial-scaled),
//   - Row 4: a single "Révolution partielle / totale" toggle.
// The partial flag + angles live on the SOURCE arc's shape3D.
export default function ToolbarEditProxyRevolution({ onDragStart }) {
  // data

  const selectedAnnotation = useSelectedAnnotation();
  const updateAnnotation = useUpdateAnnotation();
  const hasThreedPeer = useHasThreedViewerPeer();
  const navigateThreedCamera = useNavigateThreedCameraToAnnotation();

  // state

  const [busy, setBusy] = useState(false);

  // helpers

  if (!selectedAnnotation) return null;

  const isPartial = !!selectedAnnotation.revolutionProxy2D?.partial;
  const label =
    selectedAnnotation.templateLabel ||
    selectedAnnotation.annotationTemplate?.label ||
    "Révolution";
  const surface = selectedAnnotation._inheritedQties?.surface ?? null;

  // handlers

  async function handleTogglePartial() {
    const srcId = selectedAnnotation.proxySourceAnnotationId;
    if (!srcId || busy) return;
    setBusy(true);
    try {
      const src = await db.annotations.get(srcId);
      if (!src) return;
      const nextPartial = !src.shape3D?.partialRevolution;
      const shape3D = { ...src.shape3D, partialRevolution: nextPartial };
      // Seed a visible default range the first time partial is enabled.
      if (nextPartial && src.shape3D?.revolutionAngleStart == null) {
        shape3D.revolutionAngleStart = DEFAULT_ANGLE_START;
        shape3D.revolutionAngleEnd = DEFAULT_ANGLE_END;
      }
      await updateAnnotation({ id: src.id, shape3D });
    } finally {
      setBusy(false);
    }
  }

  // render

  return (
    <Box
      sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      <Paper
        elevation={6}
        sx={{ borderRadius: 3, overflow: "hidden", minWidth: 230 }}
      >
        {/* Row 1 - source-arc template (draggable) */}
        <Box
          onMouseDown={onDragStart}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            px: 1.25,
            py: 0.75,
            borderBottom: "1px solid",
            borderColor: "divider",
            cursor: "grab",
            userSelect: "none",
            "&:active": { cursor: "grabbing" },
          }}
        >
          <GripIcon
            fontSize="small"
            sx={{ color: "text.disabled", flexShrink: 0 }}
          />
          <AnnotationTemplateIcon
            template={
              selectedAnnotation.annotationTemplate || selectedAnnotation || {}
            }
            size={16}
          />
          <Typography
            variant="body2"
            sx={{
              flex: 1,
              fontWeight: 600,
              fontSize: "0.8rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {label}
          </Typography>
          {hasThreedPeer && (
            <Tooltip title="Centrer la vue 3D sur l'annotation">
              <IconButton
                size="small"
                onClick={() => navigateThreedCamera(selectedAnnotation)}
                onMouseDown={(e) => e.stopPropagation()}
                sx={{
                  flexShrink: 0,
                  color: "text.disabled",
                  "&:hover": { bgcolor: "action.hover", color: "text.primary" },
                }}
              >
                <ThreeDRotationIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Row 3 - revolved surface (inherited, partial-scaled) */}
        {surface != null && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              px: 1.25,
              py: 0.25,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <AnnotationMeasurements surface={surface} />
          </Box>
        )}

        {/* Row 4 - partial / total toggle */}
        <Box sx={{ display: "flex", alignItems: "center", px: 1.25, py: 0.5 }}>
          <Button
            size="small"
            variant={isPartial ? "contained" : "outlined"}
            disabled={busy}
            onClick={handleTogglePartial}
            onMouseDown={(e) => e.stopPropagation()}
            startIcon={isPartial ? <PartialIcon /> : <TotalIcon />}
            sx={{ textTransform: "none", fontSize: "0.75rem", flex: 1 }}
          >
            {isPartial ? "Révolution partielle" : "Révolution totale"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
