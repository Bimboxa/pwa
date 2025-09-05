import { useSelector } from "react-redux";

import { Dialog } from "@mui/material";

import PageScopeCreator from "./PageScopeCreator";

export default function DialogAutoScopeCreator() {
  // data

  const open = useSelector((s) => s.scopeCreator.openScopeCreator);

  // render

  return (
    <Dialog fullScreen open={open}>
      <PageScopeCreator />
    </Dialog>
  );
}
