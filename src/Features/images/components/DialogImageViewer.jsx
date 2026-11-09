import { useRef } from "react";

import { Box, Dialog, IconButton, Tooltip, Typography } from "@mui/material";
import CenterFocusStrong from "@mui/icons-material/CenterFocusStrong";
import Close from "@mui/icons-material/Close";

import useZoomPanTransform from "../hooks/useZoomPanTransform";

// ---------------------------------------------------------------------------
// DialogImageViewer — an image shown large, on a dark stage: wheel zoom
// (anchored on the cursor), drag pan, and a "reset" button that frames the
// whole image again. Reusable (PopperImages "Fullscreen" tile button).
// ---------------------------------------------------------------------------

export default function DialogImageViewer({ open, onClose, src, title }) {
  // strings

  const resetS = "Réinitialiser le zoom";
  const closeS = "Fermer";

  // state

  const stageRef = useRef(null);
  const { cssTransform, isIdentity, panning, reset, handlers } =
    useZoomPanTransform({ stageRef, minK: 1, maxK: 20 });

  // render

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      slotProps={{
        paper: {
          sx: { height: "90vh", display: "flex", flexDirection: "column" },
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography
          variant="body2"
          noWrap
          sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}
        >
          {title || ""}
        </Typography>
        <Tooltip title={resetS}>
          <span>
            <IconButton size="small" onClick={reset} disabled={isIdentity}>
              <CenterFocusStrong fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={closeS}>
          <IconButton size="small" onClick={onClose}>
            <Close fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Box
        ref={stageRef}
        {...handlers}
        onDoubleClick={reset}
        sx={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          overflow: "hidden",
          bgcolor: "#111",
          cursor: panning ? "grabbing" : "grab",
          touchAction: "none",
        }}
      >
        {src && (
          <img
            src={src}
            alt={title || ""}
            draggable={false}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              transform: cssTransform,
              transformOrigin: "0 0",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        )}
      </Box>
    </Dialog>
  );
}
