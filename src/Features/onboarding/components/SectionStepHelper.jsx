import { Box } from "@mui/material";
import ImageAnimatedMap from "./ImageAnimatedMap";

export default function SectionStepHelper() {
  return (
    <Box
      sx={{
        width: 600,
        height: 1,
        bgcolor: "white",
      }}
    >
      <ImageAnimatedMap />
    </Box>
  );
}
