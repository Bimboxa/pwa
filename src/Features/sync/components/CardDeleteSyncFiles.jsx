import {useDispatch} from "react-redux";

import {setOpenPanelSync} from "../syncSlice";

import useDownloadScopeData from "../hooks/useDownloadScopeData";
import useRemoteContainer from "../hooks/useRemoteContainer";

import CardGeneric from "Features/layout/components/CardGeneric";
import useDeleteSyncFiles from "../hooks/useDeleteSyncFiles";

export default function CardDeleteSyncFiles() {
  const dispatch = useDispatch();

  // data

  const deleteSyncFiles = useDeleteSyncFiles();

  // helpers

  const title = "Nettoyer les fichiers de synchro";

  const description = `Les fichiers de synchros seront supprimés en local.
  Pour sauvegarder, utilisez la sauvegarde globale`;

  const buttonLabel = "Supprimer";

  // handlers

  async function handleClick() {
    await deleteSyncFiles();
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
