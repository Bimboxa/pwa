import { useMemo, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedListingId } from "Features/listings/listingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import useListingGroupsWithIcons from "../hooks/useListingGroupsWithIcons";

import { Box, Button, Typography } from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import LeftDrawerPanelHeader from "Features/leftPanel/components/LeftDrawerPanelHeader";
import ListListings from "Features/listings/components/ListListings";
import SectionListingsGroup from "./SectionListingsGroup";
import DialogCreateBusinessObjectListing from "Features/businessObjects/components/DialogCreateBusinessObjectListing";
import DialogCreateBaseMapListing from "Features/baseMapEditor/components/DialogCreateBaseMapListing";
import DialogCreateListing from "Features/listings/components/DialogCreateListing";

import getListingGroupsByEntityModelType from "Features/listings/utils/getListingGroupsByEntityModelType";

// Listing selector of the SCOPE module: every listing of the scope whatever
// its nature (base maps, annotations, business objects, exports...), grouped
// by family (base maps first, then annotations, then one group per business
// object type). Each group header carries its family icon and a "+" opening
// that family's own creation dialog — there is no panel-level "+": a listing
// always belongs to a family, so the generic entry point only asked a question
// the group already answers. A click selects the listing — which narrows the
// recap editor and sends the listing properties to the right panel; there is
// no subview to drill into.
export default function SelectorListingForViewer({ selectedListingId }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Listes";
  const createListingS = "Nouvelle liste";
  const emptyS = "Aucune liste dans ce repérage.";

  // data

  const appConfig = useAppConfig();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: listings, loading } = useListingsByScope({
    filterByProjectId: projectId,
  });

  // state

  // Creation dialog to display: null, or {kind, typeKey} — the group's "+"
  // pins the family, the panel "+" opens the generic business-object dialog
  // with its own type selector.
  const [createTarget, setCreateTarget] = useState(null);

  // helpers

  const entityModelTypes = appConfig?.features?.entityModelTypes;
  const rawGroups = useMemo(
    () =>
      getListingGroupsByEntityModelType({
        listings,
        entityModelTypes,
      }),
    [listings, entityModelTypes]
  );
  const groups = useListingGroupsWithIcons(rawGroups);
  const isEmpty = !loading && groups.length === 0;
  const selection = selectedListingId ? [selectedListingId] : [];

  // handlers

  // Selecting drives what the right panel SHOWS, but never opens it: the
  // panel is the user's to open (the "..." menu and the properties tool lead
  // there). Creation is the exception below — a listing you just made is
  // waiting to be configured.
  function selectListing(listing) {
    dispatch(setSelectedListingId(listing.id));
    dispatch(setSelectedItem({ id: listing.id, type: "LISTING" }));
  }

  function deselectListing() {
    dispatch(setSelectedListingId(null));
    dispatch(setSelectedItem(null));
  }

  // Clicking the selected listing again clears the selection, which puts the
  // editor back on the all-listings totals.
  function handleListingClick(listing) {
    if (listing.id === selectedListingId) deselectListing();
    else selectListing(listing);
  }

  function handleListingCreated(listing) {
    if (!listing) return;
    selectListing(listing);
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  function handleCloseCreate() {
    setCreateTarget(null);
  }

  // A family without a creation dialog of its own (exports, zonings, legends…
  // are created by the flows that own them) shows no "+".
  function getCreateTargetOfGroup(group) {
    if (group.businessObjectTypeKey)
      return { kind: "BUSINESS_OBJECT", typeKey: group.businessObjectTypeKey };
    if (group.type === "BASE_MAP") return { kind: "BASE_MAP" };
    if (group.type === "LOCATED_ENTITY") return { kind: "LOCATED_ENTITY" };
    return null;
  }

  function handleCreateClick(group) {
    setCreateTarget(getCreateTargetOfGroup(group));
  }

  // render

  return (
    <BoxFlexVStretch>
      <LeftDrawerPanelHeader title={titleS} />

      {loading ? (
        <ListListings loading />
      ) : isEmpty ? (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            p: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary" align="center">
            {emptyS}
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddIcon />}
            onClick={() => setCreateTarget({ kind: "BUSINESS_OBJECT" })}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {createListingS}
          </Button>
        </Box>
      ) : (
        <BoxFlexVStretch sx={{ overflow: "auto" }}>
          {groups.map((group) => (
            <SectionListingsGroup
              key={group.key}
              group={group}
              selection={selection}
              onListingClick={handleListingClick}
              onCreateClick={
                getCreateTargetOfGroup(group) ? handleCreateClick : undefined
              }
            />
          ))}
        </BoxFlexVStretch>
      )}

      {createTarget?.kind === "BUSINESS_OBJECT" && (
        <DialogCreateBusinessObjectListing
          open
          typeKey={createTarget.typeKey}
          onClose={handleCloseCreate}
          onCreated={handleListingCreated}
        />
      )}

      {createTarget?.kind === "BASE_MAP" && (
        <DialogCreateBaseMapListing
          open
          onClose={handleCloseCreate}
          onCreated={handleListingCreated}
        />
      )}

      {createTarget?.kind === "LOCATED_ENTITY" && (
        <DialogCreateListing open onClose={handleCloseCreate} />
      )}
    </BoxFlexVStretch>
  );
}
