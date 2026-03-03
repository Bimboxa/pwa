import {useSelector, useDispatch} from "react-redux";
import {useState} from "react";

import {setOpenPanel} from "../listingsConfigSlice";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useCreateListings from "Features/listings/hooks/useCreateListings";

import ListListings from "Features/listings/components/ListListings";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function PanelTempListings() {
  const dispatch = useDispatch();

  // data

  const tempListings = useSelector((s) => s.listingsConfig.tempListings);
  const createListings = useCreateListings();
  const autoSyncMacro = useSelector((s) => s.sync.autoSyncMacro);

  const {value: scope} = useSelectedScope();

  // state

  const [loading, setLoading] = useState(false);

  // helpers

  const createS = "Créer";

  // handlers

  async function handleClick() {
    setLoading(true);
    await createListings(
      {listings: tempListings, scope},
      {forceLocalToRemote: autoSyncMacro}
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
