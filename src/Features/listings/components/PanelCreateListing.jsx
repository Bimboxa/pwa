import { useState } from "react";

import { useSelector } from "react-redux";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useAddListingToScope from "Features/scopes/hooks/useAddListingToScope";
import useCreateListing from "Features/listings/hooks/useCreateListing";

import Panel from "Features/layout/components/Panel";
import FormListing from "./FormListing";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function PanelCreateListing({ onListingCreated }) {
  // strings

  const saveS = "Créer";

  // data

  const { value: scope } = useSelectedScope();
  const addListingToScope = useAddListingToScope();
  const createListing = useCreateListing();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  // state

  const [tempListing, setTempListing] = useState({});

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
    newListing.id = _newListing.id;
    // add listing to scope
    if (scope) {
      await addListingToScope({
        listingId: _newListing.id,
        listingTable: _newListing.table,
        scope,
      });
    }

    //
    if (onListingCreated) onListingCreated();
  }

  function handleChange(listing) {
    setTempListing(listing);
  }
  return (
    <Panel>
      <FormListing listing={tempListing} onChange={handleChange} />
      <ButtonInPanel label={saveS} onClick={handleSave} />
    </Panel>
  );
}
