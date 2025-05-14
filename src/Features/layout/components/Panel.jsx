import {Box} from "@mui/material";

export default function Panel({children}) {
  return (
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
  );
}
