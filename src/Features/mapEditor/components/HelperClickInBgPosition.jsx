import { useSelector } from "react-redux";

import { Box, Typography } from "@mui/material";

export default function HelperClickInBgPosition() {
  const position = useSelector((s) => s.mapEditor.clickInBgPosition);

  const x = position?.x;
  const y = position?.y;

  if (!x || !y) return null;

  // helpers

  const xString = x.toFixed(0);
  const yString = y.toFixed(0);
  const positionString = `{x:${xString}, y:${yString}}`;
  return (
    <Box sx={{ px: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {positionString}
      </Typography>
    </Box>
  );
}
