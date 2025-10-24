import PanelCreateListing from "./PanelCreateListing";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import PanelCreateListingFromPresetListings from "./PanelCreateListingFromPresetListings";

export default function DialogCreateListing({
  open,
  onClose,
  fromPresetListings,
  locatedListingOnly,
}) {
  return (
    <DialogGeneric open={open} onClose={onClose} vh={70} width="350px">
      {!fromPresetListings && (
        <PanelCreateListing
          onListingCreated={onClose}
          locatedListingOnly={locatedListingOnly}
        />
      )}

      {fromPresetListings && (
        <PanelCreateListingFromPresetListings onListingCreated={onClose} />
      )}
    </DialogGeneric>
  );
}
