import { useState } from "react";

import { useDispatch } from "react-redux";

import { setSelectedProjectId } from "Features/projects/projectsSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useProjects from "Features/projects/hooks/useProjects";
import useCreateProject from "Features/projects/hooks/useCreateProject";
import useCreateListing from "Features/listings/hooks/useCreateListing";
import useDefaultBaseMapsListingProps from "Features/baseMaps/hooks/useDefaultBaseMapsListingProps";

import { Box, TextField, Typography } from "@mui/material";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import getFoundItems from "Features/search/getFoundItems";

import ListItemsGeneric from "Features/layout/components/ListItemsGeneric";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

export default function SectionSelectProject() {
  const dispatch = useDispatch();

  // strings

  const existingProjectsS = "Projets existants";

  // state

  const [projectRef, setProjectRef] = useState("");
  const [projectName, setProjectName] = useState("");

  // data

  const { value: projects } = useProjects();
  const appConfig = useAppConfig();
  const defaultBaseMapsListingProps = useDefaultBaseMapsListingProps();
  const createListing = useCreateListing();

  // data - func

  const createProject = useCreateProject();

  // helpers - strings

  const selectProjectS = "Votre projet";
  const projectRefS = appConfig?.strings?.project?.clientRef ?? "Référence";
  const projectNameS = appConfig?.strings?.project?.name ?? "Nom";
  const createS = "Créer";

  // helpers

  const foundProjects = getFoundItems({
    items: projects,
    searchText: projectRef + " " + projectName,
    searchKeys: ["clientRef", "name"],
  });

  // handlers

  function handleProjectRefChange(e) {
    setProjectRef(e.target.value);
  }

  function handleProjectNameChange(e) {
    setProjectName(e.target.value);
  }

  function handleProjectClick(project) {
    dispatch(setSelectedProjectId(project.id));
  }

  async function handleCreateClick() {
    // project
    const newProject = await createProject({
      name: projectName,
      clientRef: projectRef,
    });
    dispatch(setSelectedProjectId(newProject.id));

    // baseMaps listing
    await createListing({
      listing: { ...defaultBaseMapsListingProps, projectId: newProject.id },
    });
  }

  // render

  return (
    <BoxFlexVStretch sx={{ gap: 2 }}>
      <Typography sx={{ p: 1 }}>{selectProjectS}</Typography>
      <Box sx={{ width: 1, px: 1 }}>
        <TextField
          size="small"
          fullWidth
          label={projectNameS}
          value={projectName}
          onChange={handleProjectNameChange}
        />
      </Box>
      <Box sx={{ width: 1, px: 1 }}>
        <TextField
          size="small"
          fullWidth
          label={projectRefS}
          value={projectRef}
          onChange={handleProjectRefChange}
        />
      </Box>

      <Box
        sx={{
          width: 1,
          p: 1,
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <BoxFlexVStretch
          sx={{ bgcolor: "background.default", borderRadius: 1 }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
            {existingProjectsS}
          </Typography>
          <Box sx={{ width: 1, flexGrow: 1, overflow: "auto" }}>
            <Box sx={{ width: 1, bgcolor: "white" }}>
              <ListItemsGeneric
                items={foundProjects}
                onClick={handleProjectClick}
                labelKey="name"
              />
            </Box>
          </Box>
        </BoxFlexVStretch>
      </Box>

      <ButtonInPanelV2
        label={createS}
        onClick={handleCreateClick}
        variant="contained"
      />
    </BoxFlexVStretch>
  );
}
