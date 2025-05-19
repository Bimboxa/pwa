import {useState} from "react";

import {useDispatch} from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import {setOpenDialogAddListing} from "../listingsSlice";

import useResolvedPresetListings from "../hooks/useResolvedPresetListings";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useUpdateScope from "Features/scopes/hooks/useUpdateScope";
import useCreateListings from "../hooks/useCreateListings";

import Panel from "Features/layout/components/Panel";
import ListListings from "./ListListings";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import updateSyncFile from "Features/sync/services/updateSyncFile";

export default function PanelAddListingsFromPresets() {
  const dispatch = useDispatch();
  // strings

  const addS = "Ajouter";

  // data

  const listings = useResolvedPresetListings();
  const {value: scope} = useSelectedScope();
  const updateScope = useUpdateScope();
  const createListings = useCreateListings();

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

    const newScopeListings = newListings.map(({id, table}) => ({id, table}));

    const updates = {
      id: scope.id,
      sortedListings: [...scope.sortedListings, ...newScopeListings],
    };

    // update
    setLoading(true);

    // create listings
    await createListings(
      {listings: newListings, scope}
      //{forceLocalToRemote: true}
    );
    // update scope
    await updateScope(updates, {forceLocalToRemote: true});
    setLoading(false);
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
