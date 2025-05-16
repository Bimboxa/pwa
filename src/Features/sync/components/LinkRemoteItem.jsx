import {useEffect, useState, useRef} from "react";

import useFetchRemoteItemMetadata from "../hooks/useFetchRemoteItemMetadata";

import {Box, CircularProgress, Link, Tooltip, Typography} from "@mui/material";
import BoxCenter from "Features/layout/components/BoxCenter";
import {Circle} from "@mui/icons-material";
import getRemoteItemWebUrlFromMetadata from "../services/getRemoteItemWebUrlFromMetadata";

import DialogFixRemoteContainerPath from "./DialogFixRemoteContainerPath";

export default function LinkRemoteItem({label, path, variant, color}) {
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const syncingRef = useRef(false);

  // data

  const fetchRemoteItemMetadata = useFetchRemoteItemMetadata();

  // state

  const [open, setOpen] = useState(false);

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
      console.log("fetch metadata", metadata);
      setMetadata(metadata?.value);
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

    await fetchMetadata();
    setLoading(false);
  }

  function handleLinkClick() {
    setOpen(true);
  }

  return (
    <>
      <DialogFixRemoteContainerPath
        open={open}
        onClose={() => setOpen(false)}
      />
      <Box sx={{display: "flex", alignItems: "center", p: 1}}>
        <Tooltip title={webUrl ?? path} placement="top">
          <Typography
            onClick={handleLinkClick}
            // href={webUrl}
            // target="_blank"
            // rel="noopener"
            variant={variant ?? "body2"}
            color={color ?? "text.secondary"}
          >
            {label}
          </Typography>
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
    </>
  );
}
