import {useState} from "react";
import {useDispatch, useSelector} from "react-redux";

import {setOpenSelectorPanel} from "Features/listings/listingsSlice";

import useSelectedListing from "../hooks/useSelectedListing";

import IconListingVariantClickable from "./IconListingVariantClickable";

import DialogFsOrMenu from "Features/layout/components/DialogFsOrMenu";
import PanelSelectorListing from "./PanelSelectorListing";

export default function IconButtonListingSelector() {
  const dispatch = useDispatch();

  // strings

  const title = "Sélectionnez une liste";

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // data

  const {value: selectedListing} = useSelectedListing();
  const selectedListingId = selectedListing?.id;
  const open = useSelector((s) => s.listings.openSelectorPanel);

  // handlers

  function handleIconButtonClick(anchorEl) {
    dispatch(setOpenSelectorPanel(true));
    setAnchorEl(anchorEl);
  }

  function handleCloseMenu() {
    dispatch(setOpenSelectorPanel(false));
    setAnchorEl(null);
  }

  function handleListingSelected() {
    dispatch(setOpenSelectorPanel(false));
  }

  return (
    <>
      <IconListingVariantClickable
        listing={selectedListing}
        onClick={handleIconButtonClick}
        open={open}
      />
      <DialogFsOrMenu
        open={open}
        onClose={handleCloseMenu}
        anchorEl={anchorEl}
        title={title}
      >
        <PanelSelectorListing
          onListingSelected={handleListingSelected}
          selectedListingId={selectedListingId}
        />
      </DialogFsOrMenu>
    </>
  );
}
