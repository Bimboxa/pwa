import { Box } from "@mui/material";
import AutoAwesome from "@mui/icons-material/AutoAwesome";
import Timeline from "@mui/icons-material/Timeline";

// Guide-line icon with a star badge marking the auto behavior.
export default function IconAutoSlope() {
  return (
    <Box sx={{ position: "relative", display: "inline-flex" }}>
      <Timeline />
      <AutoAwesome
        sx={{
          fontSize: "9px !important",
          position: "absolute",
          top: -3,
          right: -4,
        }}
      />
    </Box>
  );
}
