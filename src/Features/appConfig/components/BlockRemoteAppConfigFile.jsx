import {useState} from "react";
import useRemoteContainer from "Features/sync/hooks/useRemoteContainer";

import {Box, IconButton, Typography, Link} from "@mui/material";
import {Refresh} from "@mui/icons-material";
import useFetchRemoteFile from "Features/sync/hooks/useFetchRemoteFile";
import yamlToJsonAsync from "Features/files/utils/yamlToJsonAsync";
import setAppConfigInLocalStorage from "../services/setAppConfigInLocalStorage";
import BlockTestRemoteItem from "Features/sync/components/BlockTestRemoteItem";
import LinkRemoteItem from "Features/sync/components/LinkRemoteItem";

export default function BlockRemoteAppConfigFile() {
  // strings

  const title = "Configuration partagée";

  // state

  const [loading, setLoading] = useState(false);

  // data

  const remoteContainer = useRemoteContainer();
  const fetchRemoteFile = useFetchRemoteFile();

  // helpers

  const filePath = remoteContainer?.path + "/appConfig.yml";

  let subtitle = "Aucun fichier trouvé";
  if (remoteContainer) {
    subtitle = `Fichier ${remoteContainer?.service}: ${remoteContainer?.path}`;
  }

  // handlers

  async function handleClick() {
    try {
      const blob = await fetchRemoteFile(filePath);
      const appConfig = await yamlToJsonAsync(blob);
      console.log("appConfig", appConfig);
      setAppConfigInLocalStorage(appConfig);
    } catch (e) {
      console.log("error", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{display: "flex", alignItems: "center", p: 1}}>
      <LinkRemoteItem label={subtitle} path={filePath} />

      <IconButton sx={{ml: 1}} onClick={handleClick} loading={loading}>
        <Refresh />
      </IconButton>
    </Box>
  );
}
