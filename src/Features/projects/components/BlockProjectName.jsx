import useSelectedProject from "../hooks/useSelectedProject";

import {Box, Typography} from "@mui/material";

export default function BlockProjectName() {
  const project = useSelectedProject();

  return (
    <Box sx={{p: 1}}>
      <Typography variant="h6">{project?.name}</Typography>
    </Box>
  );
}
