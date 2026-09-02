import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedListingId } from "../businessObjectsSlice";

import { Box, IconButton, Tooltip } from "@mui/material";
import { EditNote, AccountTree } from "@mui/icons-material";

import LeftDrawerPanelHeader from "Features/leftPanel/components/LeftDrawerPanelHeader";

import useBusinessObjectListings from "../hooks/useBusinessObjectListings";
import useBusinessObjectsModuleLabel from "../hooks/useBusinessObjectsModuleLabel";

import FieldActiveBusinessObjectListing from "./FieldActiveBusinessObjectListing";
import BusinessObjectsTree from "./BusinessObjectsTree";
import SectionQuickEditBusinessObjects from "./SectionQuickEditBusinessObjects";

// Left panel of the BUSINESS_OBJECTS module ("Ouvrages"): listing selector on
// top (FieldActiveListing pattern), objects tree of the selected listing
// below.
export default function PanelBusinessObjects() {
  const dispatch = useDispatch();

  // data

  const moduleLabel = useBusinessObjectsModuleLabel();
  const listings = useBusinessObjectListings();
  const selectedListingId = useSelector(
    (s) => s.businessObjects.selectedListingId
  );

  // state

  // quick text edition of the whole tree (replaces the tree view)
  const [quickEditOpen, setQuickEditOpen] = useState(false);

  // helpers

  const activeListing =
    listings?.find((l) => l.id === selectedListingId) ?? null;

  // effects — auto-select the first listing when none is selected (or the
  // selected one left the scope).

  useEffect(() => {
    if (!listings?.length) return;
    if (activeListing) return;
    dispatch(setSelectedListingId(listings[0].id));
  }, [listings, activeListing, dispatch]);

  // switching listings closes the quick editor (its draft targets one listing)
  useEffect(() => {
    setQuickEditOpen(false);
  }, [selectedListingId]);

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: 1,
        minHeight: 0,
        borderRight: "1px solid",
        borderColor: "divider",
      }}
    >
      <LeftDrawerPanelHeader title={moduleLabel} />
      <FieldActiveBusinessObjectListing
        listings={listings}
        activeListing={activeListing}
      />

      {activeListing && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", px: 1, mt: -0.5 }}>
          <Tooltip
            title={quickEditOpen ? "Retour à l'arbre" : "Édition rapide (texte)"}
          >
            <IconButton
              size="small"
              color={quickEditOpen ? "primary" : "default"}
              onClick={() => setQuickEditOpen((v) => !v)}
            >
              {quickEditOpen ? (
                <AccountTree sx={{ fontSize: 18 }} />
              ) : (
                <EditNote sx={{ fontSize: 18 }} />
              )}
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {activeListing && quickEditOpen ? (
        <SectionQuickEditBusinessObjects
          key={activeListing.id}
          listing={activeListing}
          onClose={() => setQuickEditOpen(false)}
        />
      ) : (
        <Box sx={{ overflow: "auto", flex: 1, minHeight: 0 }}>
          {activeListing && <BusinessObjectsTree listing={activeListing} />}
        </Box>
      )}
    </Box>
  );
}
