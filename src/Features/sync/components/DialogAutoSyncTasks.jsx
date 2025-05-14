import {useSelector, useDispatch} from "react-redux";

import {setOpenPanelSync} from "../syncSlice";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import SectionSyncTasks from "./SectionSyncTasks";

export default function DialogAutoSyncTasks() {
  const dispatch = useDispatch();

  // data

  const open = useSelector((s) => s.sync.openPanelSync);
  // handlers

  function handleClose() {
    dispatch(setOpenPanelSync(false));
  }

  return (
    <DialogGeneric open={open} onClose={handleClose}>
      <SectionSyncTasks />
    </DialogGeneric>
  );
}
