import {useState} from "react";

import {nanoid} from "@reduxjs/toolkit";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import useCreateRemoteFolders from "../hooks/useCreateRemoteFolders";
import useCreateRemoteFile from "../hooks/useCreateRemoteFile";
import BottomBarCancelSave from "Features/layout/components/BottomBarCancelSave";
import getRemoteItemPath from "../utils/getRemoteItemPath";

import jsonObjectToFile from "Features/files/utils/jsonObjectToFile";

export default function DialogCreateRemoteItem({
  itemPath,
  item,
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

  // state

  const [loading, setLoading] = useState(false);

  // handlers

  async function handleCreate() {
    setLoading(true);
    let newItem = {
      ...item,
      id: item.id ?? nanoid(),
    };
    if (type === "FOLDER") {
      await createRemoteFolders([itemPath]);
      onCreated();
    } else if (type === "FILE") {
      const blob = jsonObjectToFile(newItem);
      await createRemoteFile({path: itemPath, blob});
    }

    setLoading(false);
    onCreated(newItem);
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
