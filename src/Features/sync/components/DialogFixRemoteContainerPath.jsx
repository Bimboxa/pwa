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
import ButtonInPanelListFolderItems from "./ButtonInPanelListFolderItems";
import ButtonInPanelGetUserAccount from "./ButtonInPanelGetUserAccount";
import useRemoteProvider from "../hooks/useRemoteProvider";

export default function DialogFixRemoteContainerPath({open, onClose}) {
  const dispatch = useDispatch();

  // strings

  const selectS = "Sélection automatique de _data/_openedProjects.json";
  const updateS = "Mettre à jour le chemin d'accès";

  // data

  const remoteContainer = useRemoteContainer();
  const {value: accessToken} = useRemoteToken();
  const remoteProvider = useRemoteProvider();

  // effect

  useEffect(() => {
    if (open && remoteProvider) {
      (async () => {
        const targetFile = await remoteProvider.searchFile(
          "_openedProjects.js"
        );
        setUserPath(targetFile?.path);
      })();
    }
  }, [remoteProvider, open]);

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

  const disabled =
    (rcPath?.length > 4 && rcPath === remoteContainer?.path) ||
    rcPath?.length < 4;

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

      <Box sx={{p: 1, mt: 1}}>
        {/* <ButtonInPanelListFolderItems path={""} /> */}
        {/* <ButtonInPanelGetUserAccount /> */}
      </Box>

      <Box sx={{p: 2}}>
        {tests.map((test) => {
          return (
            <Typography
              key={test.value}
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
