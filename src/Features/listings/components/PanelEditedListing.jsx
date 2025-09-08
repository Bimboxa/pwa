import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function PanelEditedListing({ listing }) {
  return <BoxFlexVStretch>{listing?.name}</BoxFlexVStretch>;
}
