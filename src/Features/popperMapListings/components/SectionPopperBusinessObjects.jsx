import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedListingId } from "Features/businessObjects/businessObjectsSlice";

import { Box } from "@mui/material";

import useBusinessObjectListings from "Features/businessObjects/hooks/useBusinessObjectListings";
import useBusinessObjectCountsByListingId from "Features/businessObjects/hooks/useBusinessObjectCountsByListingId";

import BandActiveBusinessObjectListing from "Features/businessObjects/components/BandActiveBusinessObjectListing";
import BusinessObjectsTree from "Features/businessObjects/components/BusinessObjectsTree";

import activeListingCardSx from "../utils/activeListingCardSx";

// "Objets" side of PopperMapListings (business-objects modules, labelled
// after the module: "Ouvrages", "Quantités"…), organised like the Dessin
// side: the module's listings block on top (BandActiveBusinessObjectListing
// — header, listings as rows, active listing band: create / rename / delete
// / reorder) and the objects tree of the active listing below in a white
// accent card (BusinessObjectsTree — add, edit, move, link…). Same content
// as the module's left panel (PanelBusinessObjects), reachable while that
// panel is hidden (fullscreen editors). typeKey: the business object type of
// the module.
export default function SectionPopperBusinessObjects({ typeKey }) {
  const dispatch = useDispatch();

  // data

  const listings = useBusinessObjectListings({ typeKey });
  const countsByListingId = useBusinessObjectCountsByListingId();
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
      <Box sx={{ flexShrink: 0 }}>
        <BandActiveBusinessObjectListing
          typeKey={typeKey}
          listings={listings}
          activeListing={activeListing}
          countsByListingId={countsByListingId}
        />
      </Box>

      {/* Scrollable grey area (the popper Paper is white) holding the
          objects card of the active listing. */}
      <Box
        sx={{
          overflowY: "auto",
          flex: 1,
          minHeight: 0,
          pb: 1,
          bgcolor: "background.default",
        }}
      >
        {activeListing && (
          <Box
            sx={{
              mx: 1,
              overflow: "clip",
              ...activeListingCardSx("secondary.main"),
            }}
          >
            <BusinessObjectsTree listing={activeListing} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
