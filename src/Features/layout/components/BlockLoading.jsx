import {CircularProgress, Box} from "@mui/material";

export default function BlockLoading() {
  return (
    <Box
      sx={{width: 1, p: 1, py: 2, display: "flex", justifyContent: "center"}}
    >
      <CircularProgress />
    </Box>
  );
}
