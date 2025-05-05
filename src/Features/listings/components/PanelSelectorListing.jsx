import {useDispatch} from "react-redux";

import {setSelectedListingId} from "../listingsSlice";

import useListingsByScope from "../hooks/useListingsByScope";

import DialogFs from "Features/layout/components/DialogFs";
import ListListings from "./ListListings";
import {Box} from "@mui/material";
import BoxFlexHStretch from "Features/layout/components/BoxFlexHStretch";

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
    <BoxFlexHStretch sx={{overflow: "auto"}}>
      <ListListings
        loading={loading}
        listings={listings}
        onClick={handleListingClick}
        selection={selection}
      />
    </BoxFlexHStretch>
  );
}
