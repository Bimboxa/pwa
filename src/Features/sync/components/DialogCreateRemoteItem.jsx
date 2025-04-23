import {useState} from "react";

import {nanoid} from "@reduxjs/toolkit";

import useCreateRemoteFolders from "../hooks/useCreateRemoteFolders";
import useCreateRemoteFile from "../hooks/useCreateRemoteFile";
import useRemoteContainer from "../hooks/useRemoteContainer";
import useRemoteToken from "../hooks/useRemoteToken";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import BottomBarCancelSave from "Features/layout/components/BottomBarCancelSave";

import jsonObjectToFile from "Features/files/utils/jsonObjectToFile";
import RemoteProvider from "../js/RemoteProvider";

export default function DialogCreateRemoteItem({
  item,
  itemPath,
  itemFileName,
  type,
  open,
  onClose,
  onCreated,
}) {
  // helpers

  const title = itemPath;
  const saveLabel = "Créer le fichier";

  // data - func

  const createRemoteFolders = useCreateRemoteFolders();
  const createRemoteFile = useCreateRemoteFile();
  const remoteContainer = useRemoteContainer();
  const {value: accessToken} = useRemoteToken();

  // state

  const [loading, setLoading] = useState(false);

  // handlers

  async function handleCreate() {
    // init
    const remoteProvider = new RemoteProvider({
      accessToken,
      provider: remoteContainer.service,
    });

    // main
    setLoading(true);
    let newItem = {
      ...item,
      id: item.id ?? nanoid(),
    };
    if (type === "FOLDER") {
      await createRemoteFolders([itemPath]);
      onCreated();
    } else if (type === "FILE") {
      const file = jsonObjectToFile(newItem, itemFileName);
      await remoteProvider.postFile(itemPath, file);
      //await createRemoteFile({path: itemPath, blob});
      onCreated({...newItem, lastModifiedAt: file.lastModified});
    }

    setLoading(false);
  }

  // render

  return (
    <DialogGeneric open={open} onClose={onClose} title={title}>
      <BottomBarCancelSave
        onSave={handleCreate}
        saveLabel={saveLabel}
        onCancel={onClose}
        loading={loading}
      />
    </DialogGeneric>
  );
}
