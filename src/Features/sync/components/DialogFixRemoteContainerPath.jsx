import {useState, useEffect} from "react";

import useRemoteContainer from "../hooks/useRemoteContainer";
import useRemoteToken from "../hooks/useRemoteToken";

import {Typography, Box} from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";

import DropboxChooserButton from "Features/dropbox/components/DropboxChooserButton";

import RemoteProvider from "../js/RemoteProvider";

export default function DialogFixRemoteContainerPath({open, onClose}) {
  // data

  const remoteContainer = useRemoteContainer();
  const {value: accessToken} = useRemoteToken();

  // state

  const [userPath, setUserPath] = useState("...");

  const [tokenIsOk, setTokenIsOk] = useState(false);
  const [apiIsOk, setApiIsOk] = useState(false);
  const [sharedFileId, setSharedFileId] = useState(false);
  const [folderIsOk, setFolderIsOk] = useState(false);

  // tests

  const tests = [
    {label: "Token", value: tokenIsOk},
    {label: "Dropbox API", value: apiIsOk},
    {label: "Test fichier", value: folderIsOk},
  ];

  // helpers

  const title = `Connexion ${remoteContainer?.service ?? "-?-"}`;

  // helper - fetch fileMetadata

  async function fetchFileMetadata() {
    const remoteProvider = new RemoteProvider({
      accessToken,
      provider: remoteContainer.service,
    });

    const metadata = await remoteProvider.fetchFileMetadata(sharedFileId);
    console.log("metadata_33", metadata);
    const path = metadata?.path;
    if (path) {
      setFolderIsOk(true);
      setUserPath(path);
    }
  }
  // handlers

  async function handleSelectedFiles(files) {
    try {
      console.log("files", files);
      const link = files[0].link;

      const remoteProvider = new RemoteProvider({
        accessToken,
        provider: remoteContainer.service,
      });

      const metadata = await remoteProvider.fetchSharedFileMetadata(link);
      console.log("metadata", metadata);

      if (metadata?.id) setApiIsOk(true);

      setSharedFileId(metadata.id);
    } catch (e) {
      console.log("error selecting files", e, files);
    }
  }

  // tests

  useEffect(() => {
    if (accessToken) setTokenIsOk(true);
  }, [accessToken]);

  useEffect(() => {
    if (sharedFileId) {
      fetchFileMetadata();
    }
  }, [sharedFileId]);

  return (
    <DialogGeneric open={open} onClose={onClose} title={title}>
      <DropboxChooserButton onSelectedFiles={handleSelectedFiles} />
      <Box sx={{p: 2}}>
        <Typography variant="body2" color="text.secondary">
          Configuration
        </Typography>
        <Typography variant="body2" sx={{mb: 2}}>
          {remoteContainer.path}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Fichier sélectionné
        </Typography>
        <Typography variant="body2">{userPath}</Typography>
      </Box>
      <Box sx={{p: 2}}>
        {tests.map((test) => {
          return (
            <Typography
              variant="body2"
              color={test.value ? "success" : "text.secondary"}
            >
              {test.label}
            </Typography>
          );
        })}
      </Box>
    </DialogGeneric>
  );
}
