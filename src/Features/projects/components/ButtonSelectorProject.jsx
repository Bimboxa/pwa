import { useNavigate } from "react-router-dom";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";

import { Button, Typography, Tooltip } from "@mui/material";
import { ArrowBackIos as Back } from "@mui/icons-material";

export default function ButtonSelectorProject() {
  const navigate = useNavigate();

  // data

  const { value: selectedProject } = useSelectedProject();
  const appConfig = useAppConfig();

  // helpers

  const projectName = selectedProject?.name ?? "-?-";
  const selectS =
    appConfig?.strings?.project.select ?? "Sélectionner un projet";

  // handlers

  function handleClick() {
    navigate("/dashboard");
  }
  return (
    <Tooltip title={selectS}>
      <Button startIcon={<Back />} onClick={handleClick}>
        <Typography>{projectName}</Typography>
      </Button>
    </Tooltip>
  );
}
