import DialogGeneric from "Features/layout/components/DialogGeneric";
import PanelCreateListingsV3 from "./PanelCreateListingsV3";
import PanelCreateListingFromPresetListings from "./PanelCreateListingFromPresetListings";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function DialogCreateListing({
  open,
  onClose,
  fromPresetListings,
}) {
  return (
    <DialogGeneric open={open} onClose={onClose} maxWidth={false} >
      <BoxFlexVStretch sx={{ width: 800 }}>


        {!fromPresetListings && (
          <PanelCreateListingsV3 onListingCreated={onClose} />
        )}

        {fromPresetListings && (
          <PanelCreateListingFromPresetListings onListingCreated={onClose} />
        )}
      </BoxFlexVStretch>
    </DialogGeneric>
  );
}
