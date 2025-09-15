import PanelCreateListing from "./PanelCreateListing";
import DialogGeneric from "Features/layout/components/DialogGeneric";

export default function DialogCreateListing({ open, onClose }) {
  return (
    <DialogGeneric open={open} onClose={onClose} vh={70} width="350px">
      <PanelCreateListing onListingCreated={onClose} />
    </DialogGeneric>
  );
}
