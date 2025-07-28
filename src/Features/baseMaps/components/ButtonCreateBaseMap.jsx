import { useDispatch } from "react-redux";

import { setIsCreatingBaseMap } from "../baseMapsSlice";

import ButtonCreateGeneric from "Features/layout/components/ButtonCreateGeneric";

export default function ButtonCreateBaseMap() {
  const dispatch = useDispatch();

  // strings

  const createS = "Créer un fond de plan";

  // handlers

  function handleClick() {
    dispatch(setIsCreatingBaseMap(true));
  }

  // render

  return <ButtonCreateGeneric label={createS} onClick={handleClick} />;
}
