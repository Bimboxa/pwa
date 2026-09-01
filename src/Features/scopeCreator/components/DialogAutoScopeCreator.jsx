import { useSelector, useDispatch } from "react-redux";

import { setOpenScopeCreator } from "Features/scopeCreator/scopeCreatorSlice";

import DialogCreateScopeFromPreset from "./DialogCreateScopeFromPreset";

export default function DialogAutoScopeCreator() {
  const dispatch = useDispatch();

  // data

  const open = useSelector((s) => s.scopeCreator.openScopeCreator);
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  // handlers

  function handleClose() {
    dispatch(setOpenScopeCreator(false));
  }

  // render

  if (!open) return null;

  return (
    <DialogCreateScopeFromPreset
      open={open}
      onClose={handleClose}
      projectId={projectId}
    />
  );
}
