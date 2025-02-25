import {Box} from "@mui/material";

export default function BoxCenter({children, sx}) {
  return (
    <Box
      sx={{
        height: 1,
        width: 1,
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
