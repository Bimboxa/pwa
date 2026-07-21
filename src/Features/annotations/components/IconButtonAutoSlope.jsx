import { Box, IconButton, Tooltip } from "@mui/material";
import Timeline from "@mui/icons-material/Timeline";
import AutoAwesome from "@mui/icons-material/AutoAwesome";

import useApplyAutoSlope from "../hooks/useApplyAutoSlope";

// Immediate action (no drawing mode): computes the slope connecting the two
// polygons adjacent to the selected POLYGON. Same guide-line icon as
// IconButtonAddGuideLine, with a star badge marking the auto behavior.
export default function IconButtonAutoSlope({ accentColor }) {
  const applyAutoSlope = useApplyAutoSlope();

  return (
    <Tooltip title="Pente auto">
      <IconButton
        size="small"
        onClick={applyAutoSlope}
        sx={{
          color: "text.disabled",
          "&:hover": {
            color: accentColor,
            bgcolor: accentColor + "18",
          },
        }}
      >
        <Box sx={{ position: "relative", display: "inline-flex" }}>
          <Timeline fontSize="small" />
          <AutoAwesome
            sx={{ fontSize: 9, position: "absolute", top: -3, right: -4 }}
          />
        </Box>
      </IconButton>
    </Tooltip>
  );
}
