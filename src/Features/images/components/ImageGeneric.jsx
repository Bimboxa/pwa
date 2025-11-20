import { useState } from "react";
import { Box, IconButton } from "@mui/material";
import { Fullscreen } from "@mui/icons-material";
import DialogGeneric from "Features/layout/components/DialogGeneric";

export default function ImageGeneric({ url, height, objectFit }) {
  const [openDialog, setOpenDialog] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  function handleOpenDialog() {
    setOpenDialog(true);
  }

  function handleCloseDialog() {
    setOpenDialog(false);
  }

  return (
    <>
      <Box
        sx={{ position: "relative", width: "100%", height: height ?? "100%" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img
          src={url}
          style={{
            objectFit: objectFit ?? "contain",
            width: "100%",
            maxHeight: height ?? "100%",
          }}
        />
        {isHovered && (
          <IconButton
            onClick={handleOpenDialog}
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              bgcolor: "rgba(0, 0, 0, 0.5)",
              color: "white",
              "&:hover": {
                bgcolor: "rgba(0, 0, 0, 0.7)",
              },
              zIndex: 1,
            }}
            size="small"
          >
            <Fullscreen fontSize="small" />
          </IconButton>
        )}
      </Box>
      <DialogGeneric
        open={openDialog}
        onClose={handleCloseDialog}
        vw={90}
        vh={90}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            height: "100%",
            p: 2,
          }}
        >
          <img
            src={url}
            style={{
              objectFit: "contain",
              maxWidth: "100%",
              maxHeight: "100%",
            }}
            alt="Full size"
          />
        </Box>
      </DialogGeneric>
    </>
  );
}
