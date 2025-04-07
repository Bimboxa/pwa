import {useEffect, useState, useRef} from "react";

import useFetchRemoteItemMetadata from "../hooks/useFetchRemoteItemMetadata";

import {Box, CircularProgress} from "@mui/material";
import BoxCenter from "Features/layout/components/BoxCenter";
import {Circle} from "@mui/icons-material";

export default function BlockTestRemoteItem({path}) {
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const syncingRef = useRef(false);

  // data

  const fetchRemoteItemMetadata = useFetchRemoteItemMetadata();

  // helpers

  const color = metadata ? "success.main" : "error.main";

  // helpers - func

  const fetchMetadata = async () => {
    if (syncingRef.current) return;
    setLoading(true);
    syncingRef.current = true;
    try {
      const metadata = await fetchRemoteItemMetadata(path);
      setMetadata(metadata);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
      syncingRef.current = false;
    }
  };

  // effect

  useEffect(() => {
    if (path) {
      fetchMetadata();
    }
  }, [path]);
  return (
    <Box sx={{width: 30, height: 30}}>
      <BoxCenter>
        {loading && <CircularProgress size={10} />}
        {!loading && <Circle sx={{color}} fontSize="small" />}
      </BoxCenter>
    </Box>
  );
}
