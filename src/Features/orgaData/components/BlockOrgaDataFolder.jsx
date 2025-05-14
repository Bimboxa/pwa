import {useState} from "react";

import {Box, Typography, IconButton} from "@mui/material";
import {Download} from "@mui/icons-material";

import useFetchOrgaDataFolder from "../hooks/useFetchOrgaDataFolder";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import getFetchOrgaDataSuccessInLocalStorage from "../services/getFetchOrgaDataSuccessInLocalStorage";

export default function BlockOrgaDataFolder() {
  // strings

  const orgaDataS = "Données de l'entreprise: ";
  // data

  const fetchOrgaData = useFetchOrgaDataFolder();
  const appConfig = useAppConfig();

  // state

  const [loading, setLoading] = useState(false);

  // helpers

  const downloaded = getFetchOrgaDataSuccessInLocalStorage();
  const orgaData = appConfig?.orgaData;

  // handlers

  async function handleClick() {
    setLoading(true);
    try {
      await fetchOrgaData();
    } catch (e) {
      console.error("Error fetching orgaData:", e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: 1,
      }}
    >
      <Box sx={{display: "flex", alignItems: "center"}}>
        <Typography variant="body2" sx={{mr: 1}}>
          {orgaDataS}
        </Typography>
        <Typography
          variant="body2"
          color={downloaded ? "text.primary" : "text.secondary"}
        >
          {orgaData?.pathRelative}
        </Typography>
      </Box>
      <IconButton onClick={handleClick} loading={loading}>
        <Download />
      </IconButton>
    </Box>
  );
}
