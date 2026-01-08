import PanelCreateListing from "./PanelCreateListing";
import PanelCreateListingV2 from "./PanelCreateListingV2";
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
        <PanelCreateListingV2
          onListingCreated={onClose}
        />
      )}

      {fromPresetListings && (
        <PanelCreateListingFromPresetListings onListingCreated={onClose} />
      )}
    </DialogGeneric>
  );
}
