import useSelectedProject from "Features/projects/hooks/useSelectedProject";

import { Button, Typography } from "@mui/material";
import { ArrowDropDown as Down } from "@mui/icons-material";

export default function SelectorProject() {
  // data

  const { value: selectedProject } = useSelectedProject();

  // helpers

  const projectName = selectedProject?.name ?? "Sélectionnez un projet";

  return (
    <>
      <Button endIcon={<Down />}>
        <Typography>{projectName}</Typography>
      </Button>
    </>
  );
}
