import {useState} from "react";
import {useDispatch} from "react-redux";

import useSelectedListing from "../hooks/useSelectedListing";

import IconListingVariantClickable from "./IconListingVariantClickable";

import DialogFsOrMenu from "Features/layout/components/DialogFsOrMenu";
import PanelSelectorListing from "./PanelSelectorListing";

export default function IconButtonListingSelector() {
  const dispatch = useDispatch();

  // state

  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  // data

  const {value: selectedListing} = useSelectedListing();

  // handlers

  function handleIconButtonClick(anchorEl) {
    setOpen(true);
    setAnchorEl(anchorEl);
  }

  function handleCloseMenu() {
    setOpen(false);
    setAnchorEl(null);
  }

  function handleListingSelected() {
    setOpen(false);
  }

  return (
    <>
      <IconListingVariantClickable
        listing={selectedListing}
        onClick={handleIconButtonClick}
        open={open}
      />
      <DialogFsOrMenu open={open} onClose={handleCloseMenu} anchorEl={anchorEl}>
        <PanelSelectorListing onListingSelected={handleListingSelected} />
      </DialogFsOrMenu>
    </>
  );
}
