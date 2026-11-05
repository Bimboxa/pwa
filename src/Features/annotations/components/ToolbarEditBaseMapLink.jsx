import { useState } from "react";

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
} from "@mui/icons-material";

import theme from "Styles/theme";

import IconSectionLine from "Features/icons/IconSectionLine";
import RowBaseMapLinkActions from "Features/baseMapLinks/components/RowBaseMapLinkActions";
import useBaseMapLinkActions from "Features/baseMapLinks/hooks/useBaseMapLinkActions";

import stringifyAnnotationData from "../utils/stringifyAnnotationData";
import useSelectedAnnotation from "../hooks/useSelectedAnnotation";

// Compact edit toolbar of a section mark ("trait de coupe", BASE_MAP_LINK —
// Fonds de plan module), same structure as ToolbarEditRevolutionAxis: the
// mark is a template-less helper, so the template-centric
// ToolbarEditAnnotation does not apply. Rows: identity · the mark's label
// ("A-A", shown at both ends of the mark and of its clone) · actions
// (RowBaseMapLinkActions: invert the direction, go to the other end of the
// link, delete).
//
// Selected from its clone on a vertical base map, the label and the direction
// still edit the SOURCE mark (useBaseMapLinkActions).
export default function ToolbarEditBaseMapLink({ onDragStart }) {
  // strings

  const titleS = "Trait de coupe";
  const cloneTitleS = "Trait de coupe · repérage";
  const labelS = "Repère";
  const placeholderS = "A-A";
  const keepScaleS = "Échelle du fond de plan conservée";
  const adaptScaleS = "Échelle du fond de plan calée sur ce trait";

  // data

  const selectedAnnotation = useSelectedAnnotation();
  const actions = useBaseMapLinkActions(selectedAnnotation);

  // state

  const [labelDraft, setLabelDraft] = useState(null);

  // helpers

  if (!selectedAnnotation) return null;

  const accentColor =
    selectedAnnotation.strokeColor || theme.palette.secondary.main;

  // handlers

  async function handleLabelCommit() {
    if (labelDraft == null) return;
    await actions.commitLabel(labelDraft);
    setLabelDraft(null);
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
          <IconSectionLine sx={{ fontSize: 18, color: accentColor }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {actions.isClone ? cloneTitleS : titleS}
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

        {/* Row 2 - label of the mark */}
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
            {labelS}
          </Typography>
          <InputBase
            value={labelDraft ?? actions.label}
            placeholder={placeholderS}
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

        {/* Row 3 (clone) - how the mark was located on this base map */}
        {actions.isClone && (
          <Box
            sx={{
              px: 1.25,
              py: 0.5,
              borderTop: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {selectedAnnotation.adaptScale === false
                ? keepScaleS
                : adaptScaleS}
            </Typography>
          </Box>
        )}

        {/* Row 4 - actions (direction + navigation + delete) */}
        <Box sx={{ borderTop: "1px solid", borderColor: "divider" }}>
          <RowBaseMapLinkActions actions={actions} accentColor={accentColor} />
        </Box>
      </Paper>
    </Box>
  );
}
