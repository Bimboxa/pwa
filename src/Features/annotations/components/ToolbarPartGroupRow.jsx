import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import {
  RemoveCircleOutline as RemoveIcon,
  LinearScale as SegmentIcon,
  RadioButtonChecked as PointIcon,
  CropFree as CutIcon,
} from "@mui/icons-material";

import AnnotationMeasurements from "./AnnotationMeasurements";

const ICON_BY_KIND = {
  POINTS: PointIcon,
  SEGMENTS: SegmentIcon,
  CUTS: CutIcon,
};

export default function ToolbarPartGroupRow({ group, onRemove }) {
  const Icon = ICON_BY_KIND[group.kind] || SegmentIcon;
  const baseLabel = group.captionFr;
  const countSuffix = group.count > 1 ? `s (×${group.count})` : "";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.25,
        py: 0.75,
        "&:hover": { bgcolor: "action.hover" },
        transition: "background 0.1s",
      }}
    >
      <Icon fontSize="small" sx={{ color: "text.secondary", flexShrink: 0 }} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            fontSize: "0.8rem",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {baseLabel}
          {countSuffix && (
            <Typography
              component="span"
              variant="body2"
              sx={{
                fontSize: "0.8rem",
                fontWeight: 400,
                color: "text.secondary",
              }}
            >
              {countSuffix}
            </Typography>
          )}
        </Typography>
        <AnnotationMeasurements
          surface={group.surface ?? null}
          length={group.length ?? null}
        />
      </Box>

      <Tooltip title="Retirer de la sélection">
        <IconButton
          size="small"
          onClick={onRemove}
          sx={{
            flexShrink: 0,
            color: "text.disabled",
            "&:hover": { color: "error.main", bgcolor: "error.lighter" },
          }}
        >
          <RemoveIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
