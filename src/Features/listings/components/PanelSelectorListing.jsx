import {useDispatch} from "react-redux";

import {setSelectedListingId} from "../listingsSlice";

import useListingsByScope from "../hooks/useListingsByScope";

import DialogFs from "Features/layout/components/DialogFs";
import ListListings from "./ListListings";
import {Box} from "@mui/material";

export default function PanelSelectorListing({
  onListingSelected,
  selectedListingId,
}) {
  const dispatch = useDispatch();

  // data

  const {value: listings, loading} = useListingsByScope();

  // helpers

  const selection = selectedListingId ? [selectedListingId] : [];

  // handlers

  function handleListingClick(listing) {
    dispatch(setSelectedListingId(listing.id));
    if (onListingSelected) onListingSelected();
  }

  return (
    <Box sx={{width: 1}}>
      <ListListings
        loading={loading}
        listings={listings}
        onClick={handleListingClick}
        selection={selection}
      />
    </Box>
  );
}
