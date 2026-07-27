import { useSelector, useDispatch } from "react-redux";

import { setOpenScopeCreator, setStepKey } from "Features/scopeCreator/scopeCreatorSlice";

import DialogGeneric from "Features/layout/components/DialogGeneric";

import PageScopeCreator from "./PageScopeCreator";
import DialogCreateScopeFromPreset from "./DialogCreateScopeFromPreset";

export default function DialogAutoScopeCreator() {
  const dispatch = useDispatch();

  // data

  const open = useSelector((s) => s.scopeCreator.openScopeCreator);
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  // handlers

  function handleClose() {
    dispatch(setOpenScopeCreator(false));
    dispatch(setStepKey("SEARCH_PROJECT"));
  }
  // render

  if (!open) return null;

  // simplified 2-field dialog when a project is already selected;
  // the stepper flow remains for entry points without a selected project.
  if (projectId) {
    return (
      <DialogCreateScopeFromPreset
        open={open}
        onClose={handleClose}
        projectId={projectId}
      />
    );
  }

  return (
    <DialogGeneric open={open} width={350} onClose={handleClose} vh={80}>
      {open && <PageScopeCreator />}
    </DialogGeneric>
  );
}
