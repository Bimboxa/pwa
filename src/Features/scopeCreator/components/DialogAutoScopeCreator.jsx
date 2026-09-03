import { useSelector, useDispatch } from "react-redux";

import { setOpenScopeCreator } from "Features/scopeCreator/scopeCreatorSlice";

import DialogCreateScopeFromPreset from "./DialogCreateScopeFromPreset";
import DialogCreateScopeSimple from "./DialogCreateScopeSimple";

export default function DialogAutoScopeCreator() {
  const dispatch = useDispatch();

  // data

  const open = useSelector((s) => s.scopeCreator.openScopeCreator);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  // device preference: full card selector vs compact dialog
  const configurationsManagement = useSelector(
    (s) => s.appConfig.configurationsManagement
  );

  // handlers

  function handleClose() {
    dispatch(setOpenScopeCreator(false));
  }

  // render

  if (!open) return null;

  const DialogComponent = configurationsManagement
    ? DialogCreateScopeFromPreset
    : DialogCreateScopeSimple;

  return (
    <DialogComponent open={open} onClose={handleClose} projectId={projectId} />
  );
}
