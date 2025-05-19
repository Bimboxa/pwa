import {useState, useEffect} from "react";

import {useDispatch} from "react-redux";

import {forceUpdate} from "Features/appConfig/appConfigSlice";

import useRemoteContainer from "../hooks/useRemoteContainer";
import useRemoteToken from "../hooks/useRemoteToken";

import {Typography, Box} from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";

import DropboxChooserButton from "Features/dropbox/components/DropboxChooserButton";

import RemoteProvider from "../js/RemoteProvider";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

import setRemoteContainerPathInLocalStorage from "Features/appConfig/services/setRemoteContainerPathInLocalStorage";

export default function DialogFixRemoteContainerPath({open, onClose}) {
  const dispatch = useDispatch();

  // strings

  const selectS = "Sélectionnez le fichier _data/_openedProjects.json";
  const updateS = "Mettre à jour le chemin d'accès";

  // data

  const remoteContainer = useRemoteContainer();
  const {value: accessToken} = useRemoteToken();

  // state

  const [pathLower, setPathLower] = useState("");
  const [userPath, setUserPath] = useState("...");
  const rcPath = userPath
    ? userPath.split("/_data/_openedProjects.js")?.[0]
    : "";

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
  const disabled = rcPath?.length > 0 && rcPath === remoteContainer?.path;

  // helper - fetch fileMetadata

  async function fetchFileMetadata() {
    const remoteProvider = new RemoteProvider({
      accessToken,
      provider: remoteContainer.service,
    });

    const metadata = await remoteProvider.fetchFileMetadata(pathLower);
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
      console.log("debug_1905 metadata", metadata);

      if (metadata?.id) setApiIsOk(true);

      console.log("debug_1905 metadata.path_lower", metadata.path_lower);
      setSharedFileId(metadata.path_lower);
      setPathLower(metadata.path_lower);
    } catch (e) {
      console.log("debug_1905 error selecting files", e, files);
    }
  }

  function handleUpdate() {
    setRemoteContainerPathInLocalStorage(rcPath);
    dispatch(forceUpdate());
  }

  // tests

  useEffect(() => {
    if (accessToken) setTokenIsOk(true);
  }, [accessToken]);

  useEffect(() => {
    if (pathLower) {
      fetchFileMetadata();
    }
  }, [pathLower]);

  return (
    <DialogGeneric open={open} onClose={onClose} title={title}>
      <Box sx={{p: 1}}>
        <Box
          sx={{
            p: 1,
            borderRadius: "4px",
            border: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="body2">{selectS}</Typography>
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
            <Typography variant="body2">{rcPath}</Typography>
            <ButtonInPanel
              label={updateS}
              onClick={handleUpdate}
              disabled={disabled}
              bgcolor="secondary.main"
            />
          </Box>
        </Box>
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
