import {useState} from "react";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import useCreateRemoteFolders from "../hooks/useCreateRemoteFolders";
import BottomBarCancelSave from "Features/layout/components/BottomBarCancelSave";

export default function DialogCreateRemoteProjectContainer({
  remoteProject,
  remoteContainer,
  open,
  onClose,
}) {
  // strings

  const title = "Créer le dossier";

  // data - func

  const createRemoteFolders = useCreateRemoteFolders();

  // state

  const [loading, setLoading] = useState(false);

  // handlers

  async function handleCreate() {
    setLoading(true);
    const path = remoteContainer.projectsPath + "/" + remoteProject.clientRef;
    await createRemoteFolders([path]);
    setLoading(false);
  }

  // render

  return (
    <DialogGeneric open={open} onClose={onClose} title={title}>
      <BottomBarCancelSave
        onSave={handleCreate}
        onCancel={onClose}
        loading={loading}
      />
    </DialogGeneric>
  );
}
