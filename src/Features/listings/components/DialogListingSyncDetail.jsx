import DialogGeneric from "Features/layout/components/DialogGeneric";
import PanelListingSyncDetail from "Features/sync/components/PanelListingSyncDetail";

export default function DialogListingSyncDetail({open, onClose}) {
  return (
    <DialogGeneric open={open} onClose={onClose}>
      <PanelListingSyncDetail />
    </DialogGeneric>
  );
}
