import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedListingId, setPanelTabKey } from "../businessObjectsSlice";

import { Box, IconButton, Tab, Tabs, Tooltip } from "@mui/material";
import { EditNote, AccountTree } from "@mui/icons-material";

import LeftDrawerPanelHeader from "Features/leftPanel/components/LeftDrawerPanelHeader";

import useBusinessObjectListings from "../hooks/useBusinessObjectListings";
import useBusinessObjectsModuleLabel from "../hooks/useBusinessObjectsModuleLabel";
import { DEFAULT_BUSINESS_OBJECT_TYPE_KEY } from "../data/businessObjectTypesCatalog";

import FieldActiveBusinessObjectListing from "./FieldActiveBusinessObjectListing";
import BusinessObjectsTree from "./BusinessObjectsTree";
import SectionQuickEditBusinessObjects from "./SectionQuickEditBusinessObjects";
import SectionWorkPackages from "./SectionWorkPackages";
import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";

const PANEL_TABS = [
  { id: "WORK_STATIONS", label: "Poste de travail" },
  { id: "WORK_PACKAGES", label: "Tâches" },
];

// Left panel of a business-objects module ("Ouvrages" for the STANDARD
// type): listing selector on top (FieldActiveListing pattern), objects tree
// of the selected listing below. Only the listings of `typeKey` are listed.
export default function PanelBusinessObjects({
  typeKey = DEFAULT_BUSINESS_OBJECT_TYPE_KEY,
}) {
  const dispatch = useDispatch();

  // data

  const moduleLabel = useBusinessObjectsModuleLabel(typeKey);
  const listings = useBusinessObjectListings({ typeKey });
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
        <Box
          sx={{ display: "flex", justifyContent: "flex-end", px: 1, mt: -0.5 }}
        >
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

      {showWorkPackages ? (
        <SectionWorkPackages key={activeListing.id} listing={activeListing} />
      ) : activeListing && quickEditOpen ? (
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
