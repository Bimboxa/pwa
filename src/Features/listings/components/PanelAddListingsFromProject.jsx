import {useState} from "react";

import {useDispatch, useSelector} from "react-redux";

import {setOpenDialogAddListing} from "../listingsSlice";

import useProjectSharedListings from "../hooks/useProjectSharedListings";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useUpdateScope from "Features/scopes/hooks/useUpdateScope";

import Panel from "Features/layout/components/Panel";
import ListListings from "./ListListings";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

import getItemsByKey from "Features/misc/utils/getItemsByKey";

export default function PanelAddListingsFromProject() {
  const dispatch = useDispatch();
  // strings

  const addS = "Ajouter";

  // data

  const listings = useProjectSharedListings();
  const {value: scope} = useSelectedScope();
  const updateScope = useUpdateScope();
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
    const newListings = tempSelection
      .map((id) => listingsById[id])
      .map(({id, table, type}) => ({id, table, type}));
    const updates = {
      id: scope.id,
      sortedListings: [...scope.sortedListings, ...newListings],
    };

    // update
    setLoading(true);
    await updateScope(updates, {forceLocalToRemote: autoSyncMacro});
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
