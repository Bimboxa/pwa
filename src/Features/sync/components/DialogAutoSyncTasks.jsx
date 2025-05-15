import {useSelector, useDispatch} from "react-redux";

import {setOpenPanelSync} from "../syncSlice";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import SectionSyncTasks from "./SectionSyncTasks";
import SectionSyncFilesToPush from "./SectionSyncFilesToPush";

export default function DialogAutoSyncTasks() {
  const dispatch = useDispatch();

  // data

  const open = useSelector((s) => s.sync.openPanelSync);
  const syncTasks = useSelector((s) => s.sync.syncTasks);

  // handlers

  function handleClose() {
    dispatch(setOpenPanelSync(false));
  }

  // helpers

  const syncing = syncTasks?.length > 0;
  console.log("syncTasks", syncTasks);

  return (
    <DialogGeneric open={open} onClose={handleClose}>
      {syncing && <SectionSyncTasks />}
      {!syncing && <SectionSyncFilesToPush />}
    </DialogGeneric>
  );
}
