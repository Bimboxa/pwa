import { useMemo, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedListingId,
  setScopeModuleShowAllListings,
} from "Features/listings/listingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import { selectDisabledAnnotationListingIds } from "Features/listings/selectors/selectDisabledAnnotationListingIds";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import useListingItemsCountById from "Features/listings/hooks/useListingItemsCountById";
import useDisabledBaseMapIds from "Features/baseMaps/hooks/useDisabledBaseMapIds";
import useListingGroupsWithIcons from "../hooks/useListingGroupsWithIcons";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import LeftDrawerPanelHeader from "Features/leftPanel/components/LeftDrawerPanelHeader";
import ListListings from "Features/listings/components/ListListings";
import SectionListingsGroup from "./SectionListingsGroup";
import DialogCreateBusinessObjectListing from "Features/businessObjects/components/DialogCreateBusinessObjectListing";
import DialogCreateBaseMapListing from "Features/baseMapEditor/components/DialogCreateBaseMapListing";
import DialogChooseListingSource from "Features/listings/components/DialogChooseListingSource";

import getListingGroupsByEntityModelType from "Features/listings/utils/getListingGroupsByEntityModelType";
import getAnnotationListingsCount from "../utils/getAnnotationListingsCount";

// Families listed even when the scope has none of their listings yet.
const PINNED_TYPES = ["BASE_MAP", "LOCATED_ENTITY"];

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
// The base maps and annotation listings groups are always on screen, even
// empty (PINNED_TYPES): a fresh Krto has no listing at all, and the panel
// must still offer the two things it starts with. An empty annotation
// listings group shows a secondary "+ Liste de modèles d'annotations" button
// under its header (same chooser as the header's "+").
//
// A base map folder hidden in the scope (eye of its row,
// scope.baseMapsSettings.disabledListingIds) stays listed — greyed, eye off —
// so it can be shown again: this panel is the one place where the scope's
// folders are hidden / revealed. The annotation listing counts leave out the
// annotations hosted on the hidden folders' base maps, which do not exist
// for the scope.
//
// Same for an annotation listing hidden in the scope (eye of its row,
// listings.disabledAnnotationListingIds, Redux only): it stays listed —
// greyed, eye off, with its own count — and is left out of the "Afficher
// toutes les listes" total, like it is left out of every other module.
//
// `showAllListings` (listings.scopeModuleShowAllListings) is the "Afficher
// toutes les listes" row of the annotation listings group: the editor then
// shows the whole scope, and no listing row reads as selected — the caller
// passes selectedListingId null in that mode.
//
// `hideHeader`: the "Contenu" side of PopperMapListings hosts the list under
// the popper's own header (SectionPopperScopeContent). `onListingSelected`
// (after a choice) and `onClose` (the header's close cross) are a floated
// caller's; the popper passes neither.
export default function SelectorListingForViewer({
  selectedListingId,
  showAllListings = false,
  hideHeader = false,
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
  const createAnnotationListingS = "Liste de modèles d'annotations";

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: listings, loading } = useListingsByScope({
    filterByProjectId: projectId,
    includeDisabledListings: true,
  });
  const disabledAnnotationListingIds = useSelector(
    selectDisabledAnnotationListingIds
  );
  const { disabledIds: disabledBaseMapIds } = useDisabledBaseMapIds();

  // state

  // Creation dialog to display: null, or {kind, typeKey} — the group's "+"
  // (or the empty annotation listings group's button) pins the family.
  const [createTarget, setCreateTarget] = useState(null);

  // helpers

  const entityModelTypes = appConfig?.features?.entityModelTypes;
  const rawGroups = useMemo(
    () =>
      getListingGroupsByEntityModelType({
        listings,
        entityModelTypes,
        pinnedTypes: PINNED_TYPES,
      }),
    [listings, entityModelTypes]
  );
  const groups = useListingGroupsWithIcons(rawGroups);
  const itemsCountById = useListingItemsCountById(listings, {
    excludeBaseMapIds: disabledBaseMapIds,
  });
  const selection = selectedListingId ? [selectedListingId] : [];
  const annotationsCount = useMemo(
    () =>
      getAnnotationListingsCount(
        listings?.filter((l) => !disabledAnnotationListingIds.includes(l.id)),
        itemsCountById
      ),
    [listings, itemsCountById, disabledAnnotationListingIds]
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
  // `onListingSelected` is a floated caller folding back after a choice:
  // choosing all listings counts too, it is a choice like any other. The
  // creation flow below never calls it — the creation dialogs are children
  // of this component, so folding the panel would unmount the open dialog.
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

  // The annotation listings chooser (DialogChooseListingSource) relays the
  // listing DialogCreateListing hands to onClose; the other close paths
  // (cross, backdrop) pass nothing or an event — hence the shape guard.
  function handleCloseCreate(created) {
    setCreateTarget(null);
    if (created?.id && created?.entityModel) handleListingCreated(created);
  }

  function handleCreateAnnotationListingClick() {
    setCreateTarget({ kind: "LOCATED_ENTITY" });
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
      {!hideHeader && (
        <LeftDrawerPanelHeader title={titleS} onClose={onClose} />
      )}

      {loading ? (
        <ListListings loading />
      ) : (
        <BoxFlexVStretch sx={{ overflow: "auto" }}>
          {groups.map((group) => (
            <SectionListingsGroup
              key={group.key}
              group={group}
              selection={selection}
              itemsCountById={itemsCountById}
              // "Afficher toutes les listes" only once there is a list to
              // show: on the empty group the create button takes its place.
              allListingsRow={
                group.type === "LOCATED_ENTITY" && group.listings.length > 0
                  ? {
                      selected: showAllListings,
                      itemsCount: annotationsCount,
                      onClick: handleAllListingsClick,
                    }
                  : undefined
              }
              emptyAction={
                group.type === "LOCATED_ENTITY"
                  ? {
                      label: createAnnotationListingS,
                      onClick: handleCreateAnnotationListingClick,
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
