import { useMemo, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedListingId,
  setScopeModuleShowAllListings,
} from "Features/listings/listingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import useListingItemsCountById from "Features/listings/hooks/useListingItemsCountById";
import useDisabledBaseMapListingIds from "Features/baseMapEditor/hooks/useDisabledBaseMapListingIds";
import useListingGroupsWithIcons from "../hooks/useListingGroupsWithIcons";

import { Box, Button, Typography } from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import LeftDrawerPanelHeader from "Features/leftPanel/components/LeftDrawerPanelHeader";
import ListListings from "Features/listings/components/ListListings";
import SectionListingsGroup from "./SectionListingsGroup";
import DialogCreateBusinessObjectListing from "Features/businessObjects/components/DialogCreateBusinessObjectListing";
import DialogCreateBaseMapListing from "Features/baseMapEditor/components/DialogCreateBaseMapListing";
import DialogChooseListingSource from "Features/listings/components/DialogChooseListingSource";

import getListingGroupsByEntityModelType from "Features/listings/utils/getListingGroupsByEntityModelType";
import getAnnotationListingsCount from "../utils/getAnnotationListingsCount";

// Listing selector of the SCOPE module: every listing of the scope whatever
// its nature (base maps, annotations, business objects, exports...), grouped
// by family (base maps first, then annotations, then one group per business
// object type). Each group header carries a "+" opening
// that family's own creation dialog — there is no panel-level "+": a listing
// always belongs to a family, so the generic entry point only asked a question
// the group already answers. A click selects the listing — which narrows the
// recap editor and sends the listing properties to the right panel; there is
// no subview to drill into.
//
// A base map folder hidden from the Fond de plan module (eye of the tree,
// scope.baseMapsSettings.disabledListingIds) is left out here too: the scope
// content follows what the base map module shows.
//
// `showAllListings` (listings.scopeModuleShowAllListings) is the "Afficher
// toutes les listes" row of the annotation listings group: the editor then
// shows the whole scope, and no listing row reads as selected — the caller
// passes selectedListingId null in that mode.
//
// `onListingSelected` and `onClose` are the floated caller's
// (PanelSelectorListingFloating): the first folds the panel back to its recap
// after a choice, the second is the header's close cross. The docked panel
// passes neither.
export default function SelectorListingForViewer({
  selectedListingId,
  showAllListings = false,
  onListingSelected,
  onClose,
}) {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();

  // strings

  // Panel title: the scope content ("Contenu du Krto" / "Contenu du
  // dossier"), configurable per organization through strings.scope.
  const titleS =
    appConfig?.strings?.scope?.contentTitle ?? "Contenu du dossier";
  const createListingS = "Nouvelle liste";
  const emptyS = "Aucune liste dans ce repérage.";

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: listings, loading } = useListingsByScope({
    filterByProjectId: projectId,
  });
  const { disabledListingIds } = useDisabledBaseMapListingIds();

  // state

  // Creation dialog to display: null, or {kind, typeKey} — the group's "+"
  // pins the family, the panel "+" opens the generic business-object dialog
  // with its own type selector.
  const [createTarget, setCreateTarget] = useState(null);

  // helpers

  const entityModelTypes = appConfig?.features?.entityModelTypes;
  // Only base map folders can be disabled; the guard keeps the other
  // families untouched whatever the array holds.
  const visibleListings = useMemo(() => {
    if (!listings || disabledListingIds.length === 0) return listings;
    return listings.filter(
      (l) =>
        l?.entityModel?.type !== "BASE_MAP" ||
        !disabledListingIds.includes(l.id)
    );
  }, [listings, disabledListingIds]);
  const rawGroups = useMemo(
    () =>
      getListingGroupsByEntityModelType({
        listings: visibleListings,
        entityModelTypes,
      }),
    [visibleListings, entityModelTypes]
  );
  const groups = useListingGroupsWithIcons(rawGroups);
  const itemsCountById = useListingItemsCountById(visibleListings);
  const isEmpty = !loading && groups.length === 0;
  const selection = selectedListingId ? [selectedListingId] : [];
  const annotationsCount = useMemo(
    () => getAnnotationListingsCount(visibleListings, itemsCountById),
    [visibleListings, itemsCountById]
  );

  // handlers

  // Selecting drives what the right panel SHOWS, but never opens it: the
  // panel is the user's to open (the "..." menu and the properties tool lead
  // there). Creation is the exception below — a listing you just made is
  // waiting to be configured.
  function selectListing(listing) {
    dispatch(setScopeModuleShowAllListings(false));
    dispatch(setSelectedListingId(listing.id));
    dispatch(setSelectedItem({ id: listing.id, type: "LISTING" }));
  }

  // The all-listings mode is a flag of the SCOPE module, not a null
  // selectedListingId: that id is the app-wide active listing (Dessin draws
  // into it) and useAutoSelectListing would refill it at once.
  function selectAllListings() {
    dispatch(setScopeModuleShowAllListings(true));
    dispatch(setSelectedItem(null));
  }

  // Clicking the selected listing again puts the editor back on the
  // all-listings totals, like the dedicated row.
  // `onListingSelected` is the floated caller (PanelSelectorListingFloating)
  // folding back to its recap: choosing all listings counts too, it is a
  // choice like any other. The creation flow below never calls it — the
  // creation dialogs are children of this component, so folding the panel
  // would unmount the open dialog.
  function handleListingClick(listing) {
    if (listing.id === selectedListingId) selectAllListings();
    else selectListing(listing);
    onListingSelected?.();
  }

  function handleAllListingsClick() {
    selectAllListings();
    onListingSelected?.();
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
      <LeftDrawerPanelHeader title={titleS} onClose={onClose} />

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
              itemsCountById={itemsCountById}
              allListingsRow={
                group.type === "LOCATED_ENTITY"
                  ? {
                      selected: showAllListings,
                      itemsCount: annotationsCount,
                      onClick: handleAllListingsClick,
                    }
                  : undefined
              }
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
        <DialogChooseListingSource open onClose={handleCloseCreate} />
      )}
    </BoxFlexVStretch>
  );
}
