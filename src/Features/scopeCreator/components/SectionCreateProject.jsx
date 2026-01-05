import { useState } from "react";

import { useDispatch } from "react-redux";

import { setStepKey, setSelectedProjectId } from "../scopeCreatorSlice";

import useCreateProject from "Features/projects/hooks/useCreateProject";
import useCreateListing from "Features/listings/hooks/useCreateListing";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box } from "@mui/material";
import { ArrowBackIos } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FormProject from "Features/projects/components/FormProject";
import StepHeader from "./StepHeader";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import useDefaultBaseMapsListingProps from "Features/baseMaps/hooks/useDefaultBaseMapsListingProps";

export default function SectionCreateProject() {
  const dispatch = useDispatch();

  // strings

  const backS = "Retour";

  // data

  const appConfig = useAppConfig();
  const createProject = useCreateProject();
  const defaultProps = useDefaultBaseMapsListingProps();
  const createListing = useCreateListing();

  // state

  const [tempProject, setTempProject] = useState({});

  // helpers

  const title = appConfig?.strings?.project.create ?? "Créez un projet";
  const createS = "Créer";

  // handlers

  async function handleCreateProject() {
    const project = await createProject(tempProject);
    if (project) {
      dispatch(setStepKey("SELECT_PRESET_SCOPE"));
      dispatch(setSelectedProjectId(project.id));

      // create baseMaps listing
      const baseMapsListing = await createListing({
        listing: { ...defaultProps, projectId: project.id },
      });

      console.log("debug_25_09 [baseMapsListing] created baseMapsListing", baseMapsListing);
    }
  }

  function handleBackClick() {
    dispatch(setStepKey("SEARCH_PROJECT"));
  }

  // render

  return (
    <BoxFlexVStretch>
      <Box sx={{ p: 1 }}>
        <ButtonGeneric
          label={backS}
          onClick={handleBackClick}
          startIcon={<ArrowBackIos />}
        />
      </Box>
      <StepHeader title={title} />
      <Box sx={{ p: 1 }}>
        <FormProject project={tempProject} onChange={setTempProject} />
      </Box>
      <ButtonInPanelV2
        label={createS}
        onClick={handleCreateProject}
        variant="contained"
      />
    </BoxFlexVStretch>
  );
}
