import {Box, Typography} from "@mui/material";

export default function BlockViewer({viewer}) {
  return (
    <Box sx={{bgcolor: viewer.bgcolor, px: 1, borderRadius: 2, color: "white"}}>
      <Typography>{viewer.label}</Typography>
    </Box>
  );
}
