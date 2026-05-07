import { Paper, Stack } from "@mui/material";

import ButtonDrawThreed from "./ButtonDrawThreed";
import ButtonMoveThreed from "./ButtonMoveThreed";

// Floating bottom toolbar for the main 3D viewer. Hosts the drawing /
// editing tools.
export default function BottomToolbarThreed() {
  return (
    <Paper
      elevation={3}
      sx={{
        position: "absolute",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        px: 1,
        py: 0.5,
        borderRadius: "10px",
        zIndex: 10,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <ButtonDrawThreed />
        <ButtonMoveThreed />
      </Stack>
    </Paper>
  );
}
