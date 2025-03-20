import useProjects from "Features/projects/hooks/useProjects";
import useProject from "Features/projects/hooks/useSelectedProject";

import {Box, List, Typography} from "@mui/material";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ListProjects from "Features/projects/components/ListProjects";
import SectionRemoteProjectsContainers from "./SectionRemoteProjectsContainers";

export default function PageProjectSelector({
  onProjectClick,
  onRemoteContainerClick,
}) {
  // strings

  const onDeviceS = "Sur l'appareil";
  const onCloudS = "Télécharger depuis";

  // data

  const project = useProject();
  const projects = useProjects();

  // helpers

  const selection = project ? [project.id] : [];

  // handlers

  function handleProjectClick(project) {
    if (onProjectClick) onProjectClick(project);
  }

  function handleNewProjectClick() {}

  return (
    <BoxFlexVStretch sx={{bgcolor: "background.default"}}>
      <Box sx={{p: 1}}>
        <Typography variant="caption" color="text.secondary">
          {onDeviceS}
        </Typography>
      </Box>

      <Box sx={{bgcolor: "white"}}>
        <ListProjects
          projects={projects}
          selection={selection}
          onClick={handleProjectClick}
          onNewClick={handleNewProjectClick}
        />
      </Box>

      <Box sx={{p: 1}}>
        <Typography variant="caption" color="text.secondary">
          {onCloudS}
        </Typography>
      </Box>
      <Box sx={{bgcolor: "white"}}>
        <SectionRemoteProjectsContainers
          onRemoteContainerClick={onRemoteContainerClick}
        />
      </Box>
    </BoxFlexVStretch>
  );
}
