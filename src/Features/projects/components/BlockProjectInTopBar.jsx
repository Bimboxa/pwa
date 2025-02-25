import {Box} from "@mui/material";

import BlockProjectName from "./BlockProjectName";
import IconButtonMoreProject from "./IconButtonMoreProject";

export default function BlockProjectInTopBar() {
  return (
    <Box sx={{display: "flex", alignItems: "center"}}>
      <BlockProjectName />
      <IconButtonMoreProject />
    </Box>
  );
}
