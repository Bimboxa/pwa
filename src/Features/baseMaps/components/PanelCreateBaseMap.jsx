import { useDispatch } from "react-redux";

import { setOpenedPanel } from "Features/listings/listingsSlice";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionCreateBaseMap from "./SectionCreateBaseMap";

export default function PanelCreateBaseMap() {
  const dispatch = useDispatch();

  // handler

  function handleClose() {
    dispatch(setOpenedPanel("LISTING"));
  }

  return (
    <BoxFlexVStretch>
      <SectionCreateBaseMap onClose={handleClose} />
    </BoxFlexVStretch>
  );
}
