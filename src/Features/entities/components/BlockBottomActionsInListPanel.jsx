import {useState} from "react";

import {useDispatch, useSelector} from "react-redux";

import {
  setEditedEntity,
  setIsEditingEntity,
  setNewEntity,
} from "../entitiesSlice";
import {setTempMarker} from "Features/markers/markersSlice";

import useEntity from "../hooks/useEntity";
import useCreateEntity from "../hooks/useCreateEntity";
import useUpdateEntity from "../hooks/useUpdateEntity";
import useCreateMarker from "Features/markers/hooks/useCreateMarker";

import {Box} from "@mui/material";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";
import {listingsConfigSlice} from "Features/listingsConfig/listingsConfigSlice";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";

export default function BlockBottomActionsInListPanel({onSaved}) {
  const dispatch = useDispatch();

  // strings

  const createS = "Enregistrer";
  const updateS = "Mettre à jour";

  // state

  const [loading, setLoading] = useState(false);

  // data

  const entity = useEntity();
  const {value: listing} = useSelectedListing();
  console.log("[Action] entity", entity);

  const create = useCreateEntity();
  const update = useUpdateEntity();

  const tempMarker = useSelector((s) => s.markers.tempMarker);
  const createMarker = useCreateMarker();

  // helper

  const saveS = entity.id ? updateS : createS;

  // helper - display

  const show = listing?.canCreateItem;

  // handlers

  async function handleSave() {
    if (loading) return;
    setLoading(true);
    //
    if (!entity.id) {
      const newEntity = await create(entity, {updateSyncFile: true});
      if (tempMarker) {
        const {id: entityId, listingId: listingId} = newEntity;
        await createMarker({...tempMarker, entityId, listingId});
        dispatch(setTempMarker(null));
      }
      dispatch(setNewEntity({}));
    } else {
      console.log("update entity", entity);
      await update(entity.id, entity, {updateSyncFile: true});
      dispatch(setIsEditingEntity(false));
      dispatch(setEditedEntity({}));
    }
    //
    setLoading(false);
    if (onSaved) onSaved();
  }

  return (
    <Box sx={{width: 1, display: show ? "flex" : "none"}}>
      <ButtonInPanel label={saveS} onClick={handleSave} loading={loading} />
    </Box>
  );
}
