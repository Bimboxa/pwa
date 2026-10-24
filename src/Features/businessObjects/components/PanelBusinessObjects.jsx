import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedListingId, setPanelTabKey } from "../businessObjectsSlice";

import { Box, IconButton, Tab, Tabs, Tooltip } from "@mui/material";
import { EditNote, AccountTree } from "@mui/icons-material";

import LeftDrawerPanelHeader from "Features/leftPanel/components/LeftDrawerPanelHeader";

import useBusinessObjectListings from "../hooks/useBusinessObjectListings";
import useBusinessObjectCountsByListingId from "../hooks/useBusinessObjectCountsByListingId";
import useBusinessObjectsModuleLabel from "../hooks/useBusinessObjectsModuleLabel";
import useDefaultSelectionInBusinessObjectsModule from "../hooks/useDefaultSelectionInBusinessObjectsModule";
import { DEFAULT_BUSINESS_OBJECT_TYPE_KEY } from "../data/businessObjectTypesCatalog";

import BandActiveBusinessObjectListing from "./BandActiveBusinessObjectListing";
import BusinessObjectsTree from "./BusinessObjectsTree";
import SectionQuickEditBusinessObjects from "./SectionQuickEditBusinessObjects";
import SectionWorkPackages from "./SectionWorkPackages";
import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";

import activeListingCardSx from "Features/popperMapListings/utils/activeListingCardSx";

const PANEL_TABS = [
  { id: "WORK_STATIONS", label: "Poste de travail" },
  { id: "WORK_PACKAGES", label: "Tâches" },
];

// Left panel of a business-objects module ("Ouvrages" for the STANDARD
// type), organised like the Dessin panel: the listings block on top
// (BandActiveBusinessObjectListing — header, listings as rows, active
// listing band), the content of the active listing below in a white accent
// card (objects tree, quick editor or work packages) — the selected listing
// row and the content card share the same secondary left border, reading
// as one. Only the listings of `typeKey` are listed.
export default function PanelBusinessObjects({
  typeKey = DEFAULT_BUSINESS_OBJECT_TYPE_KEY,
}) {
  const dispatch = useDispatch();

  // data

  const moduleLabel = useBusinessObjectsModuleLabel(typeKey);
  const listings = useBusinessObjectListings({ typeKey });
  const countsByListingId = useBusinessObjectCountsByListingId();
  const selectedListingId = useSelector(
    (s) => s.businessObjects.selectedListingId
  );
  const panelTabKey = useSelector((s) => s.businessObjects.panelTabKey);

  // state

  // quick text edition of the whole tree (replaces the tree view)
  const [quickEditOpen, setQuickEditOpen] = useState(false);

  // helpers

  const activeListing =
    listings?.find((l) => l.id === selectedListingId) ?? null;
  // PLANNING listings: second tab of work packages.
  const hasWorkPackages = Boolean(
    activeListing &&
    getBusinessObjectTypeOfListing(activeListing).features?.workPackages
  );
  const showWorkPackages = hasWorkPackages && panelTabKey === "WORK_PACKAGES";

  // Content card of the active listing: same white accent card as its
  // selected row above (activeListingCardSx). `clip`, not `hidden`: the tree's
  // sticky hours total must stick to the panel's scroll area, and an
  // overflow: hidden card would become its scroll container.
  const contentCardSx = {
    mx: 1,
    overflow: "clip",
    ...activeListingCardSx("secondary.main"),
  };

  // effects — with nothing selected, the module lands on its listing's
  // properties (right panel).

  useDefaultSelectionInBusinessObjectsModule(activeListing);

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
        // Grey block: the header, the listings and the content area read as
        // one, on which the selected listing and its content stand out as
        // white accent cards.
        bgcolor: "background.default",
        borderRight: "1px solid",
        borderColor: "divider",
      }}
    >
      <LeftDrawerPanelHeader title={moduleLabel} />

      <Box sx={{ flexShrink: 0 }}>
        <BandActiveBusinessObjectListing
          typeKey={typeKey}
          listings={listings}
          activeListing={activeListing}
          countsByListingId={countsByListingId}
        />
      </Box>

      {hasWorkPackages && (
        <Tabs
          value={
            panelTabKey === "WORK_PACKAGES" ? "WORK_PACKAGES" : "WORK_STATIONS"
          }
          onChange={(_e, v) => dispatch(setPanelTabKey(v))}
          variant="fullWidth"
          sx={{
            minHeight: 36,
            borderBottom: "1px solid",
            borderColor: "divider",
            "& .MuiTab-root": { minHeight: 36 },
          }}
        >
          {PANEL_TABS.map(({ id, label }) => (
            <Tab key={id} value={id} label={label} />
          ))}
        </Tabs>
      )}

      {activeListing && !showWorkPackages && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", px: 1 }}>
          <Tooltip
            title={
              quickEditOpen ? "Retour à l'arbre" : "Édition rapide (texte)"
            }
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

      {/* Work packages and the quick editor scroll by themselves (flex
          columns): the card is a flex container filling the remaining
          height. The tree does not: it sits in a scrollable grey area, in a
          card growing with its content. */}
      {showWorkPackages ? (
        <Box
          sx={{
            ...contentCardSx,
            mb: 1,
            pt: 0.5,
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
          }}
        >
          <SectionWorkPackages key={activeListing.id} listing={activeListing} />
        </Box>
      ) : activeListing && quickEditOpen ? (
        <Box
          sx={{
            ...contentCardSx,
            mb: 1,
            pt: 1,
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
          }}
        >
          <SectionQuickEditBusinessObjects
            key={activeListing.id}
            listing={activeListing}
            onClose={() => setQuickEditOpen(false)}
          />
        </Box>
      ) : (
        <Box sx={{ overflowY: "auto", flex: 1, minHeight: 0, pb: 1 }}>
          {activeListing && (
            <Box sx={contentCardSx}>
              <BusinessObjectsTree listing={activeListing} />
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
