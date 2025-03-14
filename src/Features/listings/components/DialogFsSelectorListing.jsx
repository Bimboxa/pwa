import {useDispatch} from "react-redux";

import {setSelectedListingId} from "../listingsSlice";

import useListings from "../hooks/useListings";

import DialogFs from "Features/layout/components/DialogFs";
import ListListings from "./ListListings";

export default function DialogFsSelectorListing({open, onClose}) {
  const dispatch = useDispatch();

  // data

  const listings = useListings();

  // handlers

  function handleListingClick(listing) {
    dispatch(setSelectedListingId(listing.id));
    onClose();
  }

  function handleClose() {
    onClose();
  }

  return (
    <DialogFs open={open} onClose={handleClose}>
      <ListListings listings={listings} onClick={handleListingClick} />
    </DialogFs>
  );
}
