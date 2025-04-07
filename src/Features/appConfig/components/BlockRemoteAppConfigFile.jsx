import {useState} from "react";
import useRemoteContainer from "Features/sync/hooks/useRemoteContainer";

import {Box, IconButton, Typography} from "@mui/material";
import {Refresh} from "@mui/icons-material";
import useFetchRemoteFile from "Features/sync/hooks/useFetchRemoteFile";
import yamlToJsonAsync from "Features/files/utils/yamlToJsonAsync";
import setAppConfigInLocalStorage from "../services/setAppConfigInLocalStorage";
import BlockTestRemoteItem from "Features/sync/components/BlockTestRemoteItem";

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
  if (remoteContainer)
    subtitle = `Fichier ${remoteContainer?.service}: ${remoteContainer?.path}`;

  // handlers

  async function handleClick() {
    try {
      const blob = await fetchRemoteFile(filePath);
      const appConfig = await yamlToJsonAsync(blob);
      setAppConfigInLocalStorage(appConfig);
    } catch (e) {
      console.log("error", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{display: "flex", alignItems: "center", p: 1}}>
      <Box>
        <Typography>{title}</Typography>
        <Box sx={{display: "flex", alignItems: "center"}}>
          <Typography variant="body2" color="text.secondary" sx={{mr: 1}}>
            {subtitle}
          </Typography>
          <BlockTestRemoteItem path={filePath} />
        </Box>
      </Box>
      <IconButton sx={{ml: 1}} onClick={handleClick} loading={loading}>
        <Refresh />
      </IconButton>
    </Box>
  );
}
