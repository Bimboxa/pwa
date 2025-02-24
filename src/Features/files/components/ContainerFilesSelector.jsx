import React, {useState} from "react";

import {Box, Typography} from "@mui/material";
import {CloudUpload} from "@mui/icons-material";

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

  // state

  const [hover, setHover] = useState();

  // handlers

  function handleFilesChange(files) {
    onFilesChange(files);
  }
  function handleFilesChangeFromButton(files) {
    if (multiple) {
      onFilesChange(files);
    } else {
      onFilesChange([files]);
    }
  }

  // helper - files object

  const fileObjects = files?.map((file) => ({
    id: file.name,
    name: file.name,
    file: file,
  }));

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

  return (
    <Box
      sx={{
        width: 1,
        height: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {loading && <Typography>...</Typography>}
      {!loading && (
        <Box sx={{flex: 1, p: 2, width: 1}}>
          <Box
            sx={{
              position: "relative",
              width: 1,
              height: 1,
              py: 1,
              px: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              bgcolor,
              color: "common.white",
              borderRadius: "4px",
              ...(hover && {background}),
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
                borderColor: (theme) =>
                  hover ? theme.palette.primary.flash : theme.palette.divider,
              }}
            />
            <CloudUpload color="inherit" />
            <Typography variant="body2" color="inherit" sx={{mt: 1}}>
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
        </Box>
      )}
    </Box>
  );
}
