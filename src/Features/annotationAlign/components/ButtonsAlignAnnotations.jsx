import { useMemo, useState } from "react";

import { Box, Divider, IconButton, Tooltip } from "@mui/material";

import useAnnotationPermissions from "Features/mapEditor/hooks/useAnnotationPermissions";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useReadOnlyScope from "Features/scopes/hooks/useReadOnlyScope";
import useAlignAnnotations from "../hooks/useAlignAnnotations";

import {
  ALIGN_MODES,
  ALIGN_TARGETS_REASON,
  MIN_ALIGN_TARGETS,
} from "../constants/alignModes";
import { ALIGN_MODE_ICONS } from "../constants/alignModeIcons";
import getAlignTargets from "../utils/getAlignTargets";

const ACCENT_COLOR = "#6366F1";
// Index of the first mode moving along y (divider before it).
const FIRST_VERTICAL_INDEX = 3;

// Align / centre buttons of the multi-selection toolbar
// (ToolbarEditAnnotations): the six modes of ALIGN_MODES, applied to the
// alignable annotations of the selection (getAlignTargets).
// `annotations`: selected resolved annotations; `allAnnotations`: the full
// resolved list of the editor (shared-point detection).
export default function ButtonsAlignAnnotations({
  annotations,
  allAnnotations,
}) {
  // data

  const baseMap = useMainBaseMap();
  const { canEditAnnotation } = useAnnotationPermissions({
    annotations: allAnnotations,
  });
  const { isReadOnly } = useReadOnlyScope();
  const align = useAlignAnnotations();

  // state

  const [busy, setBusy] = useState(false);

  // helpers

  const targets = useMemo(
    () =>
      isReadOnly
        ? []
        : getAlignTargets({
            annotations,
            baseMapId: baseMap?.id,
            canEdit: (a) => canEditAnnotation(a.id, { silent: true }),
          }),
    [annotations, baseMap?.id, canEditAnnotation, isReadOnly]
  );
  const disabled = busy || targets.length < MIN_ALIGN_TARGETS;

  // handlers

  async function handleClick(mode) {
    setBusy(true);
    try {
      await align(mode, { targets, allAnnotations });
    } finally {
      setBusy(false);
    }
  }

  // render

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
      {ALIGN_MODES.map(({ key, label }, index) => {
        const Icon = ALIGN_MODE_ICONS[key];
        return (
          <Box key={key} sx={{ display: "flex", alignItems: "center" }}>
            {index === FIRST_VERTICAL_INDEX && (
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            )}
            <Tooltip
              title={
                targets.length < MIN_ALIGN_TARGETS
                  ? ALIGN_TARGETS_REASON
                  : label
              }
            >
              <span>
                <IconButton
                  size="small"
                  disabled={disabled}
                  onClick={() => handleClick(key)}
                  sx={{
                    color: "text.secondary",
                    "&:hover": {
                      color: ACCENT_COLOR,
                      bgcolor: ACCENT_COLOR + "18",
                    },
                  }}
                >
                  <Icon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        );
      })}
    </Box>
  );
}
