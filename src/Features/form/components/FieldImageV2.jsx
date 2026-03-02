import { useRef, useState } from "react";

import { Box, Typography, IconButton, Chip } from "@mui/material";
import { Delete, ContentPaste } from "@mui/icons-material";

import WhiteSectionGeneric from "./WhiteSectionGeneric";

import resizeImageToLowResolution from "Features/images/utils/resizeImageToLowResolution";
import ImageObject from "Features/images/js/ImageObject";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";

// ─── helpers ─────────────────────────────────────────────────────────────────

async function processFile(file, maxSize) {
  if (!file) return null;
  if (maxSize && file.size > maxSize * 1024) {
    file = await resizeImageToLowResolution(file, maxSize * 1024);
  }
  const imageObject = await ImageObject.create({ imageFile: file });
  return { entityField: imageObject.toEntityField(), size: file.size };
}

// ─── component ───────────────────────────────────────────────────────────────

export default function FieldImageV2({ label, value, onChange, options }) {
  const inputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileSizeAsString, setFileSizeAsString] = useState(null);

  // options
  const maxSize = options?.maxSize; // in KB

  // derived
  const imageSrc = value?.imageUrlClient;
  const hasImage = Boolean(imageSrc);

  // ── file handling ──────────────────────────────────────────────────────────

  async function handleFile(file) {
    if (!file) return;
    const result = await processFile(file, maxSize);
    if (!result) return;
    setFileSizeAsString(stringifyFileSize(result.size));
    onChange(result.entityField);
  }

  // ── browse ─────────────────────────────────────────────────────────────────

  function handleBrowseClick() {
    inputRef.current?.click();
  }

  function handleInputChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so same file can be re-selected
    handleFile(file);
  }

  // ── paste ──────────────────────────────────────────────────────────────────

  async function handlePaste() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], "pasted-image.png", { type: imageType });
          handleFile(file);
          return;
        }
      }
    } catch (err) {
      console.warn("Clipboard paste failed:", err);
    }
  }

  // ── drag & drop ───────────────────────────────────────────────────────────

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  }

  // ── delete ────────────────────────────────────────────────────────────────

  function handleDelete() {
    setFileSizeAsString(null);
    onChange(null);
  }

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>

        {/* Header */}
        <Typography variant="body2" sx={{ fontWeight: "bold", color: "text.primary" }}>
          {label ?? "Image"}
        </Typography>

        {hasImage ? (
          /* ── Filled state ─────────────────────────────────────────────── */
          <Box sx={{ position: "relative", borderRadius: 1.5, overflow: "hidden" }}>
            <Box
              component="img"
              src={imageSrc}
              sx={{
                width: "100%",
                display: "block",
                objectFit: "cover",
                borderRadius: 1.5,
                maxHeight: 200,
              }}
            />

            {/* Delete button — top-right corner */}
            <IconButton
              size="small"
              onClick={handleDelete}
              sx={{
                position: "absolute",
                top: 6,
                right: 6,
                bgcolor: "background.paper",
                boxShadow: 1,
                "&:hover": { bgcolor: "error.light", color: "error.contrastText" },
              }}
            >
              <Delete sx={{ fontSize: 16 }} />
            </IconButton>

            {/* File size chip — bottom-left corner */}
            {fileSizeAsString && (
              <Chip
                label={fileSizeAsString}
                size="small"
                sx={{
                  position: "absolute",
                  bottom: 6,
                  left: 6,
                  fontSize: "0.7rem",
                  bgcolor: "background.paper",
                  boxShadow: 1,
                }}
              />
            )}
          </Box>
        ) : (
          /* ── Empty state ──────────────────────────────────────────────── */
          <>
            {/* Drag-and-drop zone */}
            <Box
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              sx={{
                border: (theme) =>
                  `2px dashed ${isDragOver ? theme.palette.primary.main : theme.palette.divider}`,
                borderRadius: 1.5,
                minHeight: 100,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: isDragOver ? "action.hover" : "transparent",
                transition: "all 0.15s ease",
                cursor: "pointer",
              }}
              onClick={handleBrowseClick}
            />

            {/* Action row: Parcourir (left) · Coller (right, greyed) */}
            <Box sx={{ display: "flex", justifyContent: "space-between", px: 0.5 }}>
              <Typography
                variant="body2"
                onClick={handleBrowseClick}
                sx={{ cursor: "pointer", "&:hover": { color: "primary.main" } }}
              >
                Parcourir
              </Typography>

              <Typography
                variant="body2"
                onClick={handlePaste}
                sx={{
                  cursor: "pointer",
                  color: "text.disabled",
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  "&:hover": { color: "primary.main" },
                }}
              >
                Coller
              </Typography>
            </Box>
          </>
        )}

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleInputChange}
        />
      </Box>
    </WhiteSectionGeneric>
  );
}
