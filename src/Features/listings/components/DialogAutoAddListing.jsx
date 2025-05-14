import {useSelector, useDispatch} from "react-redux";

import {setOpenDialogAddListing} from "../listingsSlice";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import PanelAddListings from "./PanelAddListings";

export default function DialogAutoAddListing() {
  const dispatch = useDispatch();

  // data

  const open = useSelector((s) => s.listings.openDialogAddListing);

  // handlers

  function handleClose() {
    dispatch(setOpenDialogAddListing(false));
  }

  return (
    <DialogGeneric open={open} onClose={handleClose}>
      <PanelAddListings />
    </DialogGeneric>
  );
}
