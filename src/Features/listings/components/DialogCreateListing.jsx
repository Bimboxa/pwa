import PanelCreateListing from "./PanelCreateListing";
import PanelCreateListingV2 from "./PanelCreateListingV2";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import PanelCreateListingFromPresetListings from "./PanelCreateListingFromPresetListings";
import { DialogTitle } from "@mui/material";

export default function DialogCreateListing({
  open,
  onClose,
  fromPresetListings,
  locatedListingOnly,
}) {
  const title = "Nouvelle liste";

  return (
    <DialogGeneric open={open} onClose={onClose} width="350px">

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
