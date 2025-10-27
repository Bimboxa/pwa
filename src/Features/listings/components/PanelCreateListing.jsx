import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import { setSelectedListingId } from "../listingsSlice";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useAddListingToScope from "Features/scopes/hooks/useAddListingToScope";
import useCreateListing from "Features/listings/hooks/useCreateListing";

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
  const addListingToScope = useAddListingToScope();
  const createListing = useCreateListing();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

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
    if (newListing.entityModel) delete newListing.entityModel;

    // create listing
    const _newListing = await createListing({ listing: newListing, scope });
    // add listing to scope
    if (scope) {
      await addListingToScope({
        listingId: _newListing.id,
        listingTable: _newListing.table,
        scope,
      });
    }

    //
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
