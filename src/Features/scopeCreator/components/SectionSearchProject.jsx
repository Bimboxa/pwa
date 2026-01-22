import { useDispatch } from "react-redux";

import { setStepKey } from "../scopeCreatorSlice";
import { setSelectedProjectId } from "../scopeCreatorSlice";

import useCreateProject from "Features/projects/hooks/useCreateProject";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import StepHeader from "./StepHeader";
import SelectorProjectFromItemsList from "Features/projectSelector/components/SelectorProjectFromItemsList";

export default function SectionSearchProject() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const createProject = useCreateProject();

  // helpers

  const title = appConfig?.strings?.project.select ?? "Sélectionnez un projet";

  // handlers

  async function handleSelectProject(project) {

    if (project.shouldCreateProject) {
      project = await createProject(project);
    }
    dispatch(setSelectedProjectId(project.id));
    dispatch(setStepKey("SELECT_PRESET_SCOPE"));
  }

  function handleCreateProject() {
    dispatch(setStepKey("CREATE_PROJECT"));
  }

  // render

  return (
    <BoxFlexVStretch>
      {/* <StepHeader title={title} /> */}
      <SelectorProjectFromItemsList
        onClick={handleSelectProject}
        onCreateClick={handleCreateProject}
      />
    </BoxFlexVStretch>
  );
}
