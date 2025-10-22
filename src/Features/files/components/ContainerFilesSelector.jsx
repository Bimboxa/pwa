import React, { useState, useEffect } from "react";

import { Box, CircularProgress, Typography, Button } from "@mui/material";
import { CloudUpload } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import BoxCenter from "Features/layout/components/BoxCenter";
import FilesSelectorButton from "Features/files/components/FilesSelectorButton";

export default function ContainerFilesSelector({
  callToActionLabel = "Glisser & déposer des fichiers",
  files,
  onFilesChange,
  accept,
  multiple,
  bgcolor = "grey.500",
  loading,
}) {
  //strings

  const selectPdf = "Depuis mon ordinateur";
  const dragS = "Glisser & déposer des PDFs";
  const pasteS = "Coller";

  // state

  const [hover, setHover] = useState();
  const [hasImagesInClipboard, setHasImagesInClipboard] = useState(false);

  // handlers

  function handleFilesChange(files) {
    onFilesChange(files);
  }
  function handleFilesChangeFromButton(files) {
    console.log("debug_1707 files", files);
    onFilesChange(files);
  }

  // Check clipboard for images
  const checkClipboardForImages = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        setHasImagesInClipboard(false);
        return;
      }

      const clipboardItems = await navigator.clipboard.read();
      let hasImages = false;

      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type.startsWith("image/")) {
            hasImages = true;
            break;
          }
        }
        if (hasImages) break;
      }

      setHasImagesInClipboard(hasImages);
    } catch (error) {
      setHasImagesInClipboard(false);
    }
  };

  async function handlePaste() {
    try {
      // Check if clipboard API is available
      if (!navigator.clipboard || !navigator.clipboard.read) {
        console.log("Clipboard API not available");
        return;
      }

      // Read clipboard contents
      const clipboardItems = await navigator.clipboard.read();

      const files = [];

      for (const clipboardItem of clipboardItems) {
        // Check if the clipboard item contains image data
        for (const type of clipboardItem.types) {
          if (type.startsWith("image/")) {
            const blob = await clipboardItem.getType(type);
            const file = new File(
              [blob],
              `pasted-image-${Date.now()}.${type.split("/")[1]}`,
              {
                type: type,
              }
            );
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        console.log("debug_1707 paste - found images:", files);
        onFilesChange(files);
        // Recheck clipboard after paste
        setTimeout(checkClipboardForImages, 100);
      } else {
        console.log("debug_1707 paste - no images found in clipboard");
      }
    } catch (error) {
      console.error("Error reading clipboard:", error);
    }
  }

  const background = (theme) =>
    `linear-gradient(to right,${theme.palette.secondary.main},${theme.palette.primary.main})`;

  // handlers - drag & drop

  function handleDragEnter() {
    setHover(true);
  }
  function handleDragLeave() {
    setHover(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setHover(false);
    try {
      const files = [];
      if (e.dataTransfer.files instanceof FileList) {
        for (let i = 0; i < e.dataTransfer.items.length; i++) {
          const item = e.dataTransfer.items[i];
          files.push(item.getAsFile());
        }
        handleFilesChange(files);
      }
    } catch (e) {
      console.log(e);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Keyboard listener for Ctrl+V
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        if (hasImagesInClipboard) {
          handlePaste();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasImagesInClipboard]);

  // Check clipboard on mount and when component becomes visible
  useEffect(() => {
    checkClipboardForImages();

    // Check clipboard periodically (every 2 seconds) when component is visible
    const interval = setInterval(checkClipboardForImages, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Box
      sx={{
        width: 1,
        height: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        //justifyContent: "center",
        position: "relative",
        // border: (theme) =>
        //   `1px solid ${
        //     hover ? theme.palette.secondary.main : theme.palette.divider
        //   }`,
      }}
    >
      {loading && (
        <BoxCenter>
          <CircularProgress />
        </BoxCenter>
      )}
      {!loading && (
        <Box sx={{ flex: 1, p: 2, width: 1 }}>
          <Box
            sx={{
              position: "relative",
              width: 1,
              height: 1,
              minHeight: "40px",
              py: 1,
              px: 1,
              display: "flex",
              alignItems: "center",
              //justifyContent: "center",
              flexDirection: "column",
              //bgcolor,
              //color: "common.white",
              borderRadius: "4px",
              border: (theme) => `1px dashed ${theme.palette.divider}`,
              borderColor: hover ? "secondary.main" : "transparent",
              //border: (theme) => `1px dashed ${theme.palette.divider}`,
            }}
          >
            <Box
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              sx={{
                position: "absolute",
                height: 1,
                width: 1,
                borderRadius: "4px",
                //border: (theme) => `2px dashed ${theme.palette.divider}`,
              }}
            />
            {/* <CloudUpload color="inherit" /> */}
            <Typography variant="body2" color="inherit" sx={{ mt: 1 }}>
              {callToActionLabel}
            </Typography>
          </Box>
        </Box>
      )}

      {!loading && (
        <Box
          sx={{
            width: 1,
            display: "flex",
            justifyContent: "left",
            color: "text.secondary",
            gap: 1,
          }}
        >
          <FilesSelectorButton
            onFilesChange={handleFilesChangeFromButton}
            buttonName={selectPdf}
            startIcon="computer"
            buttonVariant="inline"
            buttonColor="inherit"
            multiple={multiple}
            accept={accept}
          />
          <ButtonGeneric
            label={pasteS}
            onClick={handlePaste}
            size="small"
            color="inherit"
            variant="text"
            disabled={!hasImagesInClipboard}
          />
        </Box>
      )}
    </Box>
  );
}
