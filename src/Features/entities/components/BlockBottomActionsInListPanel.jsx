import {useState} from "react";

import {useDispatch} from "react-redux";
import {setEditedEntity, setIsEditingEntity} from "../entitiesSlice";

import useEntity from "../hooks/useEntity";
import useCreateEntity from "../hooks/useCreateEntity";
import useUpdateEntity from "../hooks/useUpdateEntity";

import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function BlockBottomActionsInListPanel({onSaved}) {
  const dispatch = useDispatch();

  // strings

  const createS = "Enregistrer";
  const updateS = "Mettre à jour";

  // state

  const [loading, setLoading] = useState(false);

  // data

  const entity = useEntity();

  const create = useCreateEntity();
  const update = useUpdateEntity();

  // helper

  const saveS = entity.id ? updateS : createS;

  // handlers

  async function handleSave() {
    if (loading) return;
    setLoading(true);
    //
    if (!entity.id) {
      await create(entity);
    } else {
      await update(entity.id, entity);
      dispatch(setIsEditingEntity(false));
      dispatch(setEditedEntity({}));
    }
    //
    setLoading(false);
    if (onSaved) onSaved();
  }

  return <ButtonInPanel label={saveS} onClick={handleSave} loading={loading} />;
}
