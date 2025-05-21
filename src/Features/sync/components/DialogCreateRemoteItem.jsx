import {useState} from "react";

import {nanoid} from "@reduxjs/toolkit";

import useCreateRemoteFolders from "../hooks/useCreateRemoteFolders";
import useCreateProject from "Features/projects/hooks/useCreateProject";
import useRemoteProvider from "../hooks/useRemoteProvider";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import BottomBarCancelSave from "Features/layout/components/BottomBarCancelSave";

import jsonObjectToFile from "Features/files/utils/jsonObjectToFile";
import getDateString from "Features/misc/utils/getDateString";

export default function DialogCreateRemoteItem({
  item,
  itemPath,
  syncFileType,
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
  const createProject = useCreateProject();
  const remoteProvider = useRemoteProvider();

  // state

  const [loading, setLoading] = useState(false);

  // handlers

  async function handleCreate() {
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
      const itemFileName = itemPath.split("/").pop();
      const file = jsonObjectToFile({data: newItem}, itemFileName);
      await remoteProvider.postFile({path: itemPath, file});
      //await createRemoteFile({path: itemPath, blob});

      // create local project
      if (syncFileType === "PROJECT") {
        await createProject(newItem, {
          syncRemoteFile: true,
          updatedAt: getDateString(file.lastModified),
          syncAt: getDateString(file.lastModified),
        });
      }
      onCreated({...newItem, lastModifiedAt: getDateString(file.lastModified)});
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
