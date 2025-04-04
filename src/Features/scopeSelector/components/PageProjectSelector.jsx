import {useState} from "react";

import {useDispatch} from "react-redux";

import {setPage, setProject} from "../scopeSelectorSlice";

import useProjects from "Features/projects/hooks/useProjects";
import useProject from "Features/projects/hooks/useSelectedProject";

import {Box, Typography, Dialog, DialogTitle, Button} from "@mui/material";
import {ArrowBackIos as Back} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ListProjects from "Features/projects/components/ListProjects";
import SectionRemoteProjectsContainers from "./SectionRemoteProjectsContainers";
import SectionProject from "Features/projects/components/SectionProject";
import ButtonMoreActionsProjects from "Features/projects/components/ButtonMoreActionsProjects";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function PageProjectSelector() {
  const dispatch = useDispatch();
  const appConfig = useAppConfig();

  // strings

  const title = appConfig?.strings?.project?.new;
  const projectsS = appConfig?.strings?.project?.namePlural;

  const onDeviceS = "Sur l'appareil";
  const onCloudS = "Télécharger depuis";

  // state

  const [open, setOpen] = useState(false);

  // data

  const project = useProject();
  const {value: projects, loading} = useProjects();

  // helpers

  const selection = project ? [project.id] : [];

  // handlers

  function handleBackClick() {
    dispatch(setPage("PROJECT_AND_SCOPE"));
  }

  function handleProjectClick(project) {
    dispatch(setProject(project));
    dispatch(setPage("SCOPES"));
  }

  function handleNewProjectClick() {
    setOpen(true);
  }

  function handleProjectSaved(project) {
    console.log("saved project", project);
    setOpen(false);
  }

  return (
    <>
      <BoxFlexVStretch sx={{bgcolor: "background.default"}}>
        <Box
          sx={{
            display: "flex",
            position: "relative",
            justifyContent: "space-between",
            alignItems: "center",
            width: 1,
            py: 0.5,
          }}
        >
          <Button
            onClick={handleBackClick}
            startIcon={<Back color="action" />}
          />
          <Typography
            sx={{fontWeight: "bold"}}
            variant="body2"
            color="text.secondary"
          >
            {projectsS}
          </Typography>
          <Box sx={{width: 70}} />
        </Box>
        <Box
          sx={{
            px: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {onDeviceS}
          </Typography>
          <ButtonMoreActionsProjects />
        </Box>

        <Box sx={{bgcolor: "white"}}>
          <ListProjects
            loading={loading}
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
          <SectionRemoteProjectsContainers />
        </Box>
      </BoxFlexVStretch>

      {open && (
        <Dialog open={open} onClose={() => setOpen(false)}>
          <DialogTitle>{title}</DialogTitle>
          <SectionProject
            options={{forceNew: true}}
            onSaved={handleProjectSaved}
          />
        </Dialog>
      )}
    </>
  );
}
