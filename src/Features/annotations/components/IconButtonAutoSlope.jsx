import { Box } from "@mui/material";
import Timeline from "@mui/icons-material/Timeline";
import AutoAwesome from "@mui/icons-material/AutoAwesome";

import ToolbarToolButton from "./ToolbarToolButton";

import useApplyAutoSlope from "../hooks/useApplyAutoSlope";

// Immediate action (no drawing mode): computes the slope connecting the two
// polygons adjacent to the selected POLYGON. Same guide-line icon as
// IconButtonAddGuideLine, with a star badge marking the auto behavior.
export default function IconButtonAutoSlope({ accentColor }) {
  const applyAutoSlope = useApplyAutoSlope();

  return (
    <ToolbarToolButton
      icon={
        <Box sx={{ position: "relative", display: "inline-flex" }}>
          <Timeline fontSize="small" />
          <AutoAwesome
            sx={{ fontSize: 9, position: "absolute", top: -3, right: -4 }}
          />
        </Box>
      }
      label="Pente auto"
      onClick={() => applyAutoSlope()}
      accentColor={accentColor}
    />
  );
}
