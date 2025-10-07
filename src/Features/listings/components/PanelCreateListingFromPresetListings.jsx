import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";
import { setSelectedListingId } from "../listingsSlice";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useAddListingToScope from "Features/scopes/hooks/useAddListingToScope";
import useCreateListing from "Features/listings/hooks/useCreateListing";

import Panel from "Features/layout/components/Panel";
import FormListing from "./FormListing";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import SectionSelectorPresetListings from "./SectionSelectorPresetListings";
import useCreateListingsFromPresetListingsKeys from "../hooks/useCreateListingsFromPresetListingsKeys";

export default function PanelCreateListingFromPresetListings({
  onListingCreated,
  locatedListingOnly,
}) {
  const dispatch = useDispatch();

  // strings

  const saveS = "Créer";
  const title = locatedListingOnly ? "Nouveau repérage" : null;

  // data

  const createListings = useCreateListingsFromPresetListingsKeys();

  // state

  const [selectedKey, setSelectedKey] = useState();

  // handlers

  async function handleSave() {
    const listings = await createListings({
      presetListingsKeys: [selectedKey],
    });
    dispatch(setSelectedListingId(listings?.[0]?.id));
  }

  function handleChange(selectedKeys) {
    console.log("selectedKey", selectedKeys);
    setSelectedKey(selectedKeys?.length > 0 ? selectedKeys[0] : null);
  }
  return (
    <Panel>
      {title && <HeaderTitleClose title={title} />}
      <SectionSelectorPresetListings
        selectedKeys={selectedKey ? [selectedKey] : []}
        onChange={handleChange}
        multiselection={false}
      />
      <ButtonInPanel
        label={saveS}
        onClick={handleSave}
        disabled={!selectedKey}
      />
    </Panel>
  );
}
