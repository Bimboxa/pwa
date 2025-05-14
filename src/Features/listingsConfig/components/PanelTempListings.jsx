import {useSelector, useDispatch} from "react-redux";
import {useState} from "react";

import {setOpenPanel} from "../listingsConfigSlice";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useCreateListings from "Features/listings/hooks/useCreateListings";
import useUpdateScope from "Features/scopes/hooks/useUpdateScope";

import ListListings from "Features/listings/components/ListListings";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function PanelTempListings() {
  const dispatch = useDispatch();

  // data

  const tempListings = useSelector((s) => s.listingsConfig.tempListings);
  const createListings = useCreateListings();
  const updateScope = useUpdateScope();

  const {value: scope} = useSelectedScope();

  // state

  const [loading, setLoading] = useState(false);

  // helpers

  const createS = "Créer";

  // handlers

  async function handleClick() {
    setLoading(true);
    // scope
    const sortedListings = tempListings.map((l) => ({
      id: l.id,
      table: l.table,
    }));
    const updates = {id: scope.id, sortedListings};
    await updateScope(updates, {forceLocalToRemote: true});

    // listings
    await createListings(
      {listings: tempListings, scope},
      {forceLocalToRemote: true}
    );
    setLoading(false);
    dispatch(setOpenPanel(false));
  }

  return (
    <BoxFlexVStretch>
      <BoxFlexVStretch sx={{overflow: "auto"}}>
        <ListListings listings={tempListings} />
      </BoxFlexVStretch>
      <ButtonInPanel label={createS} onClick={handleClick} loading={loading} />
    </BoxFlexVStretch>
  );
}
