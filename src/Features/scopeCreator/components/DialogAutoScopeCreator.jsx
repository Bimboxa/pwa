import { useSelector, useDispatch } from "react-redux";

import { setOpenScopeCreator } from "Features/scopeCreator/scopeCreatorSlice";

import DialogGeneric from "Features/layout/components/DialogGeneric";

import PageScopeCreator from "./PageScopeCreator";

export default function DialogAutoScopeCreator() {
  const dispatch = useDispatch();

  // data

  const open = useSelector((s) => s.scopeCreator.openScopeCreator);

  // handlers

  function handleClose() {
    dispatch(setOpenScopeCreator(false));
  }
  // render

  if (!open) return null;

  return (
    <DialogGeneric open={open} width={350} onClose={handleClose} vh={80}>
      {open && <PageScopeCreator />}
    </DialogGeneric>
  );
}
