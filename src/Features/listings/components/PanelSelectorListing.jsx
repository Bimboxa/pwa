import {useDispatch} from "react-redux";

import {setSelectedListingId} from "../listingsSlice";

import useListings from "../hooks/useListings";

import DialogFs from "Features/layout/components/DialogFs";
import ListListings from "./ListListings";
import {Box} from "@mui/material";

export default function PanelSelectorListing({onListingSelected}) {
  const dispatch = useDispatch();

  // data

  const listings = useListings();

  // handlers

  function handleListingClick(listing) {
    dispatch(setSelectedListingId(listing.id));
    if (onListingSelected) onListingSelected();
    onClose();
  }

  return (
    <Box sx={{width: 1}}>
      <ListListings listings={listings} onClick={handleListingClick} />
    </Box>
  );
}
