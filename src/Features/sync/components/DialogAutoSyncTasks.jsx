import {useSelector, useDispatch} from "react-redux";

import {setOpenPanelSync, setSyncTasks} from "../syncSlice";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import SectionSyncTasks from "./SectionSyncTasks";
import SectionSyncFilesToPush from "./SectionSyncFilesToPush";

export default function DialogAutoSyncTasks() {
  const dispatch = useDispatch();

  // data

  const open = useSelector((s) => s.sync.openPanelSync);
  const syncTasks = useSelector((s) => s.sync.syncTasks);
  const preparingSyncTasks = useSelector((s) => s.sync.preparingSyncTasks);

  // handlers

  function handleClose() {
    dispatch(setOpenPanelSync(false));
    dispatch(setSyncTasks([]));
  }

  // helpers

  const syncing = syncTasks?.length > 0 || preparingSyncTasks;
  console.log(
    "syncTasks_33",
    syncTasks.filter((s) => ["PULL", "PUSH"].includes(s.action))
  );

  return (
    <DialogGeneric open={open} onClose={handleClose}>
      {syncing && <SectionSyncTasks />}
      {!syncing && <SectionSyncFilesToPush />}
    </DialogGeneric>
  );
}
