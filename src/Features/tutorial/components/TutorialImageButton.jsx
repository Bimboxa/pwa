/* eslint-disable react/prop-types */
import { useState } from "react";

import {
  Box,
  IconButton,
  Popover,
  Skeleton,
  Tooltip,
  Typography,
} from "@mui/material";
import { Image } from "@mui/icons-material";

import useDataImageUrl from "Features/appConfig/hooks/useDataImageUrl";

// Image of a tutorial step: a small icon at the end of the step text, the
// picture itself opens in a popover on click (lazy-loaded from Data/<org>/).
export default function TutorialImageButton({ orgaCode, relativePath, alt }) {
  // strings

  const tooltipS = alt || "Voir l'exemple";
  const notFoundS = "Image introuvable";

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // data

  const { url, loading } = useDataImageUrl({
    orgaCode,
    relativePath,
    enabled: open,
  });

  // handlers

  function handleOpen(e) {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  // render

  return (
    <>
      <Tooltip title={tooltipS}>
        <IconButton
          size="small"
          aria-label={tooltipS}
          onClick={handleOpen}
          sx={{
            ml: 0.5,
            p: 0.25,
            verticalAlign: "middle",
            color: open ? "primary.main" : "text.secondary",
          }}
        >
          <Image sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { p: 1, maxWidth: 400 } } }}
      >
        <Box sx={{ width: 360, maxWidth: "80vw" }}>
          {loading ? (
            <Skeleton variant="rectangular" width="100%" height={200} />
          ) : url ? (
            <Box
              component="img"
              src={url}
              alt={alt ?? ""}
              sx={{
                display: "block",
                width: 1,
                height: "auto",
                borderRadius: 1,
                bgcolor: "common.white",
              }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
              {notFoundS}
            </Typography>
          )}
          {alt && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 0.5, px: 0.5 }}
            >
              {alt}
            </Typography>
          )}
        </Box>
      </Popover>
    </>
  );
}
