import { useState, useEffect, useRef } from "react";

import { Box, Button, CircularProgress, Typography } from "@mui/material";

import BoxCenter from "Features/layout/components/BoxCenter";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

export default function ContainerFilesSelectorV2({
  callToActionLabel = "Glisser & déposer des fichiers",
  onFilesChange,
  accept,
  multiple,
  loading,
  BgIcon,
}) {
  // strings

  const selectS = "Depuis mon ordinateur";
  const pasteS = "Coller";

  // refs

  const fileInputRef = useRef();

  // state

  const [hover, setHover] = useState(false);
  const [hasImagesInClipboard, setHasImagesInClipboard] = useState(false);

  // handlers

  function handleFilesChange(files) {
    onFilesChange(files);
  }

  function handleInputChange(e) {
    const files = [];
    for (const file of e.currentTarget.files) {
      files.push(file);
    }
    if (files.length > 0) handleFilesChange(files);
  }

  function handleZoneClick(e) {
    if (e.target.closest("button")) return;
    fileInputRef.current?.click();
  }

  // clipboard

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
      if (!navigator.clipboard || !navigator.clipboard.read) return;
      const clipboardItems = await navigator.clipboard.read();
      const files = [];
      for (const clipboardItem of clipboardItems) {
        for (const type of clipboardItem.types) {
          if (type.startsWith("image/")) {
            const blob = await clipboardItem.getType(type);
            const file = new File(
              [blob],
              `pasted-image-${Date.now()}.${type.split("/")[1]}`,
              { type }
            );
            files.push(file);
          }
        }
      }
      if (files.length > 0) {
        onFilesChange(files);
        setTimeout(checkClipboardForImages, 100);
      }
    } catch (error) {
      console.error("Error reading clipboard:", error);
    }
  }

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

  // effects

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
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [hasImagesInClipboard]);

  useEffect(() => {
    checkClipboardForImages();
    const interval = setInterval(checkClipboardForImages, 2000);
    return () => clearInterval(interval);
  }, []);

  // render

  if (loading) {
    return (
      <BoxCenter>
        <CircularProgress />
      </BoxCenter>
    );
  }

  return (
    <Box
      onClick={handleZoneClick}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      sx={{
        width: 1,
        height: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "12px",
        border: "2px dashed",
        borderColor: hover ? "secondary.main" : "divider",
        transition: "all 0.2s ease",
        cursor: "pointer",
        overflow: "hidden",
        color: "text.disabled",
        "&:hover": {
          borderColor: "secondary.main",
          color: "secondary.main",
        },
      }}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: "none" }}
        onChange={handleInputChange}
      />

      {/* Icon illustration */}
      {BgIcon && (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 2,
            transition: "color 0.2s ease",
          }}
        >
          <BgIcon />
        </Box>
      )}

      {/* Text + buttons */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
          py: 3,
          px: 2,
        }}
      >
        <Typography
          variant="body1"
          sx={{ fontWeight: 500, textAlign: "center", color: "inherit" }}
        >
          {callToActionLabel}
        </Typography>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Button
            variant="outlined"
            color="secondary"
            size="small"
            onClick={() => fileInputRef.current?.click()}
          >
            {selectS}
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            size="small"
            onClick={handlePaste}
            disabled={!hasImagesInClipboard}
          >
            {pasteS}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
