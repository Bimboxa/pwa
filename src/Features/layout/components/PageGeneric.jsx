import {Box} from "@mui/material";

export default function PageGeneric({children, sx}) {
  return (
    <Box sx={{position: "fixed", top: 0, bottom: 0, left: 0, right: 0, ...sx}}>
      {children}
    </Box>
  );
}
