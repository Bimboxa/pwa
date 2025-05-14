import {useState} from "react";

import {useDispatch} from "react-redux";
import {setOpenPanelSync} from "../syncSlice";

import useSyncFilesToPush from "../hooks/useSyncFilesToPush";
import useUploadChanges from "../hooks/useUploadChanges";
import useRemoteContainer from "../hooks/useRemoteContainer";

import CardGeneric from "Features/layout/components/CardGeneric";

export default function CardUploadChanges() {
  const dispatch = useDispatch();

  // data

  const upload = useUploadChanges();
  const syncFilesToPush = useSyncFilesToPush();
  const remoteContainer = useRemoteContainer();

  // state

  const [loading, setLoading] = useState(false);

  // helpers

  const title = "Synchroniser les modifications";

  const noChanges = !syncFilesToPush?.length > 0;

  const description = noChanges
    ? "Aucune modification"
    : `Synchroniser les modifications (x${syncFilesToPush?.length}) avec ${remoteContainer.service} `;

  const actionLabel = "Synchroniser";

  // handlers

  async function handleClick() {
    setLoading(true);
    //
    dispatch(setOpenPanelSync(true));
    await upload();
    dispatch(setOpenPanelSync(false));
    //
    setLoading(false);
  }

  // render

  return (
    <CardGeneric
      title={title}
      onClick={handleClick}
      actionLabel={actionLabel}
      description={description}
      disabled={noChanges}
    />
  );
}
