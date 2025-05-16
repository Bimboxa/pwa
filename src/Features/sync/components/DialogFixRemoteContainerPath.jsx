import {useState} from "react";

import useRemoteContainer from "../hooks/useRemoteContainer";

import DialogGeneric from "Features/layout/components/DialogGeneric";

import DropboxChooserButton from "Features/dropbox/components/DropboxChooserButton";

export default function DialogFixRemoteContainerPath({open, onClose}) {
  // data

  const remoteContainer = useRemoteContainer();

  // state

  const [userPath, setUserPath] = useState(remoteContainer?.path);

  // helpers

  const title = `Connexion ${remoteContainer?.service ?? "-?-"}`;

  // handlers

  function handleSelectedFiles(files) {
    console.log("files", files);
  }

  return (
    <DialogGeneric open={open} onClose={onClose} title={title}>
      <DropboxChooserButton onSelectedFiles={handleSelectedFiles} />
    </DialogGeneric>
  );
}
