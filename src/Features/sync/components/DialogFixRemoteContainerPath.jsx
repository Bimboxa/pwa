import {useState} from "react";

import useRemoteContainer from "../hooks/useRemoteContainer";
import useRemoteToken from "../hooks/useRemoteToken";

import {Typography} from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";

import DropboxChooserButton from "Features/dropbox/components/DropboxChooserButton";

import RemoteProvider from "../js/RemoteProvider";

export default function DialogFixRemoteContainerPath({open, onClose}) {
  // data

  const remoteContainer = useRemoteContainer();
  const {value: accessToken} = useRemoteToken();

  // state

  const [userPath, setUserPath] = useState("...");

  // helpers

  const title = `Connexion ${remoteContainer?.service ?? "-?-"}`;

  // handlers

  async function handleSelectedFiles(files) {
    console.log("files", files);
    const link = files[0].link;

    const remoteProvider = new RemoteProvider({
      accessToken,
      provider: remoteContainer.service,
    });

    const metadata = await remoteProvider.fetchSharedFileMetadata(link);
    console.log("metadata", metadata);
    const _userPath = metadata?.result.path_display;
    setUserPath(_userPath);
  }

  return (
    <DialogGeneric open={open} onClose={onClose} title={title}>
      <DropboxChooserButton onSelectedFiles={handleSelectedFiles} />
      <Typography variant="body2" sx={{mb: 2, mt: 2}}>
        {remoteContainer.path}
      </Typography>
      <Typography variant="body2">{userPath}</Typography>
    </DialogGeneric>
  );
}
