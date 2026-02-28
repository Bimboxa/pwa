import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import { setSelectedListingId } from "../listingsSlice";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useCreateListings from "Features/listings/hooks/useCreateListings";
import useListings from "Features/listings/hooks/useListings";

import Panel from "Features/layout/components/Panel";
import FormListing from "./FormListing";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

import theme from "Styles/theme";

export default function PanelCreateListing({
  onListingCreated,
  locatedListingOnly,
}) {
  const dispatch = useDispatch();

  // strings

  const saveS = "Créer";
  const title = locatedListingOnly ? "Nouvelle liste d'objets" : null;

  // data

  const { value: scope } = useSelectedScope();
  const createListings = useCreateListings();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listings = useListings({ filterByProjectId: projectId });

  // state

  const [tempListing, setTempListing] = useState({
    iconKey: "info",
    color: theme.palette.secondary.main,
    canCreateItem: true,
  });

  // handlers

  async function handleSave() {
    const newListing = {
      ...tempListing,
      projectId,
      entityModelKey: tempListing?.entityModel?.key,
      table: tempListing?.entityModel?.defaultTable,
    };
    // create listing
    const [_newListing] = await createListings({ listings: [newListing], scope });

    dispatch(setSelectedListingId(_newListing.id));
    if (onListingCreated) onListingCreated(_newListing);
  }

  function handleChange(listing) {
    setTempListing(listing);
  }
  return (
    <Panel>
      {title && <HeaderTitleClose title={title} />}
      <BoxFlexVStretch>
        <FormListing
          listing={tempListing}
          relatedListings={listings}
          onChange={handleChange}
          locatedListingOnly={locatedListingOnly}
        />
      </BoxFlexVStretch>
      <ButtonInPanelV2
        label={saveS}
        onClick={handleSave}
        variant="contained"
        color="secondary"
        disabled={!tempListing?.name}
      />
    </Panel>
  );
}
