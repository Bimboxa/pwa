import {useState} from "react";

import {useDispatch} from "react-redux";
import {setIsEditingEntity} from "../entitiesSlice";

import useEntity from "../hooks/useEntity";
import useCreateEntity from "../hooks/useCreateEntity";
import useUpdateEntity from "../hooks/useUpdateEntity";

import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function BlockBottomActionsInListPanel({onSaved}) {
  const dispatch = useDispatch();

  // strings

  const saveS = "Enregistrer";

  // state

  const [loading, setLoading] = useState(false);

  // data

  const entity = useEntity();

  const create = useCreateEntity();
  const update = useUpdateEntity();

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
    }
    //
    setLoading(false);
    if (onSaved) onSaved();
  }

  return <ButtonInPanel label={saveS} onClick={handleSave} />;
}
