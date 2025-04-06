import {Box} from "@mui/material";

export default function PageGeneric({children}) {
  return <Box sx={{top: 1, bottom: 1, left: 1, right: 1}}>{children}</Box>;
}
