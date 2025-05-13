import {useState} from "react";

import useCreateProject from "../hooks/useCreateProject";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FormProject from "./FormProject";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function SectionCreateProject({onCreated, onClose}) {
  // data

  const createProject = useCreateProject();
  const appConfig = useAppConfig();

  // helpers

  const createProjectS = appConfig.strings.project.create;
  const createS = "Créer";

  // state

  const [tempProject, setTempProject] = useState({});
  const [loading, setLoading] = useState(false);

  // handlers

  async function handleCreateProject() {
    setLoading(true);
    const newProject = await createProject(tempProject);
    setLoading(false);
    if (onCreated) onCreated({...newProject, isNew: true});
  }

  return (
    <BoxFlexVStretch>
      <HeaderTitleClose title={createProjectS} onClose={onClose} />

      <FormProject project={tempProject} onChange={setTempProject} />

      <ButtonInPanel
        label={createS}
        onClick={handleCreateProject}
        loading={loading}
      />
    </BoxFlexVStretch>
  );
}
