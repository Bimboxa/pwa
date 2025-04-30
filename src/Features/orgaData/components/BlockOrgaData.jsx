import {useState} from "react";

import {Box, Typography, IconButton} from "@mui/material";
import {Download} from "@mui/icons-material";

import useFetchRemoteOrgaData from "../hooks/useFetchRemoteOrgaData";

export default function BlockOrgaData({orgaData}) {
  // data

  const fetchOrgaData = useFetchRemoteOrgaData();

  // state

  const [loading, setLoading] = useState(false);

  // helpers

  const downloaded = Boolean(orgaData?.orgaDataInDb);

  // handlers

  async function handleClick() {
    setLoading(true);
    try {
      await fetchOrgaData(orgaData.key);
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
      <Typography color={downloaded ? "text.primary" : "text.secondary"}>
        {orgaData.name}
      </Typography>
      <IconButton onClick={handleClick} loading={loading}>
        <Download />
      </IconButton>
    </Box>
  );
}
