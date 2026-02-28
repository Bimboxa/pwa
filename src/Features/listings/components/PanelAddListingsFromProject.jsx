import {useState} from "react";

import {useDispatch} from "react-redux";

import {setOpenDialogAddListing} from "../listingsSlice";

import useProjectSharedListings from "../hooks/useProjectSharedListings";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import db from "App/db/db";

import Panel from "Features/layout/components/Panel";
import ListListings from "./ListListings";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function PanelAddListingsFromProject() {
  const dispatch = useDispatch();
  // strings

  const addS = "Ajouter";

  // data

  const listings = useProjectSharedListings();
  const {value: scope} = useSelectedScope();

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
    setLoading(true);
    // assign scopeId to selected listings
    await Promise.all(
      tempSelection.map((id) =>
        db.listings.update(id, {scopeId: scope.id})
      )
    );
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
