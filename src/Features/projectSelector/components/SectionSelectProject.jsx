import { useState } from "react";

import { useDispatch } from "react-redux";

import {
  setSelectedProjectId,
  triggerProjectsUpdate,
} from "Features/projects/projectsSlice";
import { setOnboardingIsActive } from "Features/onboarding/onboardingSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useProjects from "Features/projects/hooks/useProjects";
import useCreateProject from "Features/projects/hooks/useCreateProject";
import useCreateListing from "Features/listings/hooks/useCreateListing";
import useDefaultBaseMapsListingProps from "Features/baseMaps/hooks/useDefaultBaseMapsListingProps";

import { Box, TextField, Typography } from "@mui/material";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import { ArrowDropDown as Down, ArrowDropUp as Up } from "@mui/icons-material";

import ListItemsGeneric from "Features/layout/components/ListItemsGeneric";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import ContainerFilesSelector from "Features/files/components/ContainerFilesSelector";

import getFoundItems from "Features/search/getFoundItems";
import loadKrtoFile from "Features/krtoFile/services/loadKrtoFile";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import useCreateDefaultBlueprintsListing from "Features/blueprints/hooks/useCreateDefaultBlueprintsListing";

export default function SectionSelectProject({ onProjectSelected }) {
  const dispatch = useDispatch();

  // strings

  const existingProjectsS = "Projets existants";
  const moreS = "Plus";

  // state

  const [projectRef, setProjectRef] = useState("");
  const [projectName, setProjectName] = useState("");
  const [open, setOpen] = useState(false);

  // data

  const { value: projects } = useProjects();
  const appConfig = useAppConfig();
  const defaultBaseMapsListingProps = useDefaultBaseMapsListingProps();
  const createListing = useCreateListing();
  const createBlueprintsListing = useCreateDefaultBlueprintsListing();

  // data - func

  const createProject = useCreateProject();

  // helper - file extension

  const extension = appConfig?.features?.krto?.extension;

  // helpers - strings

  const selectProjectS = appConfig?.strings?.project?.select ?? "Projet";
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
    if (onProjectSelected) onProjectSelected(project);
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

    // blueprints
    await createBlueprintsListing({ projectId: newProject.id });

    // navigation
    if (onProjectSelected) onProjectSelected(newProject);
  }

  async function handleLoadKrtoFile(files) {
    const file = files?.[0];
    if (file) {
      console.log("file", file);
      const project = await loadKrtoFile(file);
      dispatch(triggerProjectsUpdate());
      dispatch(setOnboardingIsActive(false));
      if (onProjectSelected) onProjectSelected(project);
    }
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

      <Box
        sx={{
          width: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "right",
          px: 1,
        }}
      >
        <ButtonGeneric
          onClick={() => setOpen(!open)}
          endIcon={open ? <Up /> : <Down />}
          label={`Charger un fichier .${extension}`}
        />
      </Box>

      {open && (
        <Box sx={{ width: 1, height: 150, p: 1 }}>
          <Box
            sx={{ border: (theme) => `1px dashed ${theme.palette.divider}` }}
          >
            <ContainerFilesSelector
              callToActionLabel={`Fichier .${extension}`}
              accept={`.${extension}`}
              onFilesChange={handleLoadKrtoFile}
            />
          </Box>
        </Box>
      )}

      <ButtonInPanelV2
        label={createS}
        onClick={handleCreateClick}
        variant="contained"
      />
    </BoxFlexVStretch>
  );
}
