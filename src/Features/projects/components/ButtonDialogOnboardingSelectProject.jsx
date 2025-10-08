import { useState, useEffect } from "react";

import { useSelector, useDispatch } from "react-redux";

import { setSelectedProjectId } from "Features/projects/projectsSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import SectionSelectProject from "Features/projectSelector/components/SectionSelectProject";

export default function ButtonDialogOnboardingSelectProject() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const userProfile = useSelector((s) => s.auth.userProfile);
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  // state

  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (userProfile?.userName) setOpen(!projectId);
  }, [projectId, userProfile?.userName]);

  // helpers

  const selectProjectS =
    appConfig?.strings?.project?.select ?? "Choisir un projet";

  // handlers

  function handleClick() {
    setOpen(true);
  }

  function handleProjectSelected(project) {
    setOpen(false);
    if (project) dispatch(setSelectedProjectId(project.id));
  }

  return (
    <>
      <ButtonGeneric
        onClick={handleClick}
        label={selectProjectS}
        variant="contained"
        color="secondary"
        disabled={!userProfile?.userName}
      />
      {open && (
        <DialogGeneric
          open={open}
          onClose={() => setOpen(false)}
          width="300px"
          vh="70"
        >
          <SectionSelectProject onProjectSelected={handleProjectSelected} />
        </DialogGeneric>
      )}
    </>
  );
}
