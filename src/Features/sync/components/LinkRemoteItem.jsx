import {useEffect, useState, useRef} from "react";

import useFetchRemoteItemMetadata from "../hooks/useFetchRemoteItemMetadata";

import {Box, CircularProgress, Link} from "@mui/material";
import BoxCenter from "Features/layout/components/BoxCenter";
import {Circle} from "@mui/icons-material";
import getRemoteItemWebUrlFromMetadata from "../services/getRemoteItemWebUrlFromMetadata";

export default function LinkRemoteItem({label, path, variant, color}) {
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const syncingRef = useRef(false);

  // data

  const fetchRemoteItemMetadata = useFetchRemoteItemMetadata();

  // helpers

  const bgcolor = metadata ? "success.main" : "error.main";

  // helper - webUrl

  const webUrl = getRemoteItemWebUrlFromMetadata(
    metadata?.value,
    metadata?.service
  );
  console.log("webUrl", webUrl, metadata);

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
    <Box sx={{display: "flex", alignItems: "center", p: 1}}>
      <Link
        href={webUrl}
        target="_blank"
        rel="noopener"
        variant={variant ?? "body2"}
        color={color ?? "text.secondary"}
      >
        {label}
      </Link>
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
        }}
      >
        <BoxCenter>
          {loading && <CircularProgress size={10} />}
          {!loading && <Circle sx={{color: bgcolor}} fontSize="small" />}
        </BoxCenter>
      </Box>
    </Box>
  );
}
