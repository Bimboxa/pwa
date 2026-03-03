import {useState} from "react";

import {useDispatch, useSelector} from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import {setOpenDialogAddListing, setSelectedListingId} from "../listingsSlice";

import useResolvedPresetListings from "../hooks/useResolvedPresetListings";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useCreateListings from "../hooks/useCreateListings";

import Panel from "Features/layout/components/Panel";
import ListListings from "./ListListings";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

import getItemsByKey from "Features/misc/utils/getItemsByKey";

export default function PanelAddListingsFromPresets() {
  const dispatch = useDispatch();
  // strings

  const addS = "Ajouter";

  // data

  const listings = useResolvedPresetListings();
  const {value: scope} = useSelectedScope();
  const createListings = useCreateListings();
  const autoSyncMacro = useSelector((s) => s.sync.autoSyncMacro);

  // state

  const [tempSelection, setTempSelection] = useState([]);
  const [loading, setLoading] = useState(false);

  // helpers

  const disabled = !tempSelection?.length > 0;
  // handlers

  function handleClick(listing) {
    let newSelection = tempSelection.filter((id) => id !== listing.id);
    if (!tempSelection.includes(listing.id)) newSelection.push(listing.id);
    setTempSelection(newSelection);
  }

  async function handleSave() {
    // helpers
    const listingsById = getItemsByKey(listings, "id");
    const newListings = tempSelection.map((id) => listingsById[id]);

    // update
    setLoading(true);

    // create listings
    await createListings(
      {listings: newListings, scope},
      {forceLocalToRemote: autoSyncMacro}
    );
    setLoading(false);
    dispatch(setSelectedListingId(newListings[0].id));
    dispatch(setOpenDialogAddListing(false));
  }

  return (
    <Panel>
      <BoxFlexVStretch sx={{overflow: "auto"}}>
        <ListListings
          listings={listings}
          onClick={handleClick}
          selection={tempSelection}
        />
      </BoxFlexVStretch>
      <ButtonInPanel
        onClick={handleSave}
        label={addS}
        disabled={disabled}
        loading={loading}
      />
    </Panel>
  );
}
