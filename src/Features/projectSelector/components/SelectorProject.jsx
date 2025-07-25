import { useNavigate } from "react-router-dom";

import useSelectedProject from "Features/projects/hooks/useSelectedProject";

import { Button, Typography } from "@mui/material";
import { ArrowBackIos as Back } from "@mui/icons-material";

export default function SelectorProject() {
  const navigate = useNavigate();

  // data

  const { value: selectedProject } = useSelectedProject();

  // helpers

  const projectName = selectedProject?.name ?? "Sélectionnez un projet";

  // handlers

  function handleClick() {
    navigate("/dashboard");
  }
  return (
    <Button startIcon={<Back />} onClick={handleClick}>
      <Typography>{projectName}</Typography>
    </Button>
  );
}
