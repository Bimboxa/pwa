import {useEffect, useState, useRef} from "react";

import useFetchRemoteItemMetadata from "../hooks/useFetchRemoteItemMetadata";

import {Box, CircularProgress, Link, Tooltip} from "@mui/material";
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
    if (path && fetchRemoteItemMetadata) {
      fetchMetadata();
    }
  }, [path]);

  // handlers

  async function handleIndicatorClick() {
    setLoading(true);
    console.log("fetch metadata");
    await fetchMetadata();
    setLoading(false);
  }

  return (
    <Box sx={{display: "flex", alignItems: "center", p: 1}}>
      <Tooltip title={webUrl ?? path} placement="top">
        <Link
          href={webUrl}
          target="_blank"
          rel="noopener"
          variant={variant ?? "body2"}
          color={color ?? "text.secondary"}
        >
          {label}
        </Link>
      </Tooltip>
      <Box
        sx={{
          ml: 1,
          display: "flex",
          alignItems: "center",
        }}
      >
        <Box onClick={handleIndicatorClick} sx={{cursor: "pointer"}}>
          <BoxCenter>
            {loading && <CircularProgress size={10} />}
            {!loading && (
              <Box
                sx={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  bgcolor,
                }}
              />
            )}
          </BoxCenter>
        </Box>
      </Box>
    </Box>
  );
}
