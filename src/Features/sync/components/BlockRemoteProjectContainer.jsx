import {useEffect, useState} from "react";

import useRemoteProjectContainerProps from "../hooks/useRemoteProjectContainerProps";

import useRemoteContainer from "../hooks/useRemoteContainer";
import useFetchRemoteItemMetadata from "../hooks/useFetchRemoteItemMetadata";

import {Box, Typography, Link} from "@mui/material";
import BlockTestRemoteItem from "./BlockTestRemoteItem";
import LinkRemoteItem from "./LinkRemoteItem";

export default function BlockRemoteProjectContainer({remoteProject}) {
  console.log("[remoteProjectContainer] remoteProject", remoteProject);

  // data

  const remoteContainer = useRemoteContainer();
  const {value: props} = useRemoteProjectContainerProps();

  // data - func

  const fetchItemMetadata = useFetchRemoteItemMetadata();

  // state

  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const [openCreate, setOpenCreate] = useState(false);

  // helpers

  const title = "-";
  const path = remoteContainer.projectsPath + "/" + remoteProject.clientRef;

  // init

  const setMetadataAsync = async () => {
    if (!remoteProject) {
      return;
    }
    setLoading(true);

    const metadata = await fetchItemMetadata(path);
    setMetadata(metadata);
    setLoading(false);
  };

  // handlers

  function handleFolderClick() {
    if (!metadata) {
      setOpenCreate(true);
    }
  }

  return (
    <Box sx={{p: 1}}>
      <LinkRemoteItem path={path} label={remoteProject.label} />
    </Box>
  );
}
