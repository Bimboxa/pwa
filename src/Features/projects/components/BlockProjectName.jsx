import useSelectedProject from "../hooks/useSelectedProject";

import {Box, Typography} from "@mui/material";

export default function BlockProjectName() {
  const project = useSelectedProject();

  return (
    <Box sx={{p: 1}}>
      <Typography>{project?.name}</Typography>
    </Box>
  );
}
