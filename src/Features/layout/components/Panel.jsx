import useIsMobile from "Features/layout/hooks/useIsMobile";

import { Box, Paper } from "@mui/material";

export default function Panel({ elevation, children }) {
  const isMobile = useIsMobile();

  return (
    <>
      {isMobile && (
        <Box
          sx={{
            width: 1,
            height: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {children}
        </Box>
      )}

      {!isMobile && (
        <Paper
          elevation={elevation}
          sx={{
            width: 1,
            height: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {children}
        </Paper>
      )}
    </>
  );
}
