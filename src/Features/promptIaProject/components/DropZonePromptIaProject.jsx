import { useRef, useState } from "react";

import { Box, CircularProgress, Typography } from "@mui/material";
import { UploadFile } from "@mui/icons-material";

// Dashed drop zone, clickable (file picker). `onDrop` receives the raw
// DataTransfer so the caller can walk dropped folders; `onFiles` receives the
// files picked from the computer.
export default function DropZonePromptIaProject({
  label,
  subLabel,
  onDrop,
  onFiles,
  accept,
  multiple = false,
  loading = false,
  disabled = false,
}) {
  // state

  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const inputRef = useRef(null);

  // helpers

  const inactive = disabled || loading;

  const hasFiles = (e) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");

  // handlers

  function handleDragEnter(e) {
    if (inactive || !hasFiles(e)) return;
    dragDepth.current += 1;
    setDragOver(true);
  }

  function handleDragLeave(e) {
    if (inactive || !hasFiles(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragOver(false);
  }

  function handleDragOver(e) {
    if (!hasFiles(e)) return;
    // always swallowed: a file dropped next to the target must not make the
    // browser navigate to it
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragOver(false);
    if (inactive) return;
    onDrop(e.dataTransfer);
  }

  function handleClick() {
    if (!inactive) inputRef.current?.click();
  }

  function handleInputChange(e) {
    const files = Array.from(e.currentTarget.files ?? []);
    // same file picked twice in a row must trigger a change again
    e.currentTarget.value = "";
    if (files.length) onFiles(files);
  }

  // render

  return (
    <Box
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      sx={{
        width: 1,
        minHeight: 96,
        p: 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.5,
        border: "1.5px dashed",
        borderColor: dragOver ? "secondary.main" : "divider",
        borderRadius: 2,
        bgcolor: dragOver ? "action.hover" : "background.default",
        cursor: inactive ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        textAlign: "center",
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        style={{ display: "none" }}
      />
      {loading ? (
        <CircularProgress size={22} />
      ) : (
        <UploadFile color="action" fontSize="small" />
      )}
      <Typography variant="body2">{label}</Typography>
      {Boolean(subLabel) && (
        <Typography variant="caption" color="text.secondary">
          {subLabel}
        </Typography>
      )}
    </Box>
  );
}
