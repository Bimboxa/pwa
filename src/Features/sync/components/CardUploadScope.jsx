import {useDispatch} from "react-redux";

import {setOpenPanelSync} from "../syncSlice";

import useUploadScopeData from "../hooks/useUploadScopeData";

import CardGeneric from "Features/layout/components/CardGeneric";

export default function CardUploadScope() {
  const dispatch = useDispatch();

  // data

  const uploadData = useUploadScopeData();

  // helpers

  const title = "Enregistrer tout le project";

  const description =
    "Synchroniser toutes les données locales. Toutes les données de la mission seront enregistrées";

  const buttonLabel = "Enregistrer";

  // handlers

  async function handleClick() {
    dispatch(setOpenPanelSync(true));
    await uploadData();
    dispatch(setOpenPanelSync(false));
  }
  return (
    <CardGeneric
      title={title}
      description={description}
      onClick={handleClick}
      actionLabel={buttonLabel}
    />
  );
}
