import {Box} from "@mui/material";

export default function PageGeneric({children}) {
  return (
    <Box sx={{position: "fixed", top: 0, bottom: 1, left: 0, right: 1}}>
      {children}
    </Box>
  );
}
