import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedListingId } from "Features/businessObjects/businessObjectsSlice";

import { Box } from "@mui/material";

import useBusinessObjectListings from "Features/businessObjects/hooks/useBusinessObjectListings";

import FieldActiveBusinessObjectListing from "Features/businessObjects/components/FieldActiveBusinessObjectListing";
import BusinessObjectsTree from "Features/businessObjects/components/BusinessObjectsTree";

// "Objets" side of PopperMapListings (business-objects modules, labelled
// after the module: "Ouvrages", "Quantités"…): the module's listings
// (FieldActiveBusinessObjectListing — create / rename / delete / reorder)
// and the objects tree of the active listing (BusinessObjectsTree — add,
// edit, move, link…). Same content as the module's left panel
// (PanelBusinessObjects), reachable while that panel is hidden (fullscreen
// editors). typeKey: the business object type of the module.
export default function SectionPopperBusinessObjects({ typeKey }) {
  const dispatch = useDispatch();

  // data

  const listings = useBusinessObjectListings({ typeKey });
  const selectedListingId = useSelector(
    (s) => s.businessObjects.selectedListingId
  );

  // helpers

  const activeListing =
    listings?.find((l) => l.id === selectedListingId) ?? null;

  // effects — auto-select the first listing when none is selected (or the
  // selected one left the scope), like the left panel.

  useEffect(() => {
    if (!listings?.length) return;
    if (activeListing) return;
    dispatch(setSelectedListingId(listings[0].id));
  }, [listings, activeListing, dispatch]);

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        flex: 1,
      }}
    >
      <FieldActiveBusinessObjectListing
        listings={listings}
        activeListing={activeListing}
      />
      <Box sx={{ overflow: "auto", flex: 1, minHeight: 0 }}>
        {activeListing && <BusinessObjectsTree listing={activeListing} />}
      </Box>
    </Box>
  );
}
