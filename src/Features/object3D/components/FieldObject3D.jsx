import { useRef, useState } from "react";

import { Box, Typography, IconButton, Chip } from "@mui/material";
import { Delete, ViewInAr } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import Object3DObject from "Features/object3D/js/Object3DObject";
import testIsGlb from "Features/object3D/utils/testIsGlb";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";

async function processFile(file) {
  if (!file) return null;
  if (!testIsGlb(file)) {
    console.warn("[FieldObject3D] file is not a .glb", file?.name);
    return null;
  }
  const object3D = await Object3DObject.create({ file });
  return { entityField: object3D.toEntityField(), size: file.size };
}

function formatMeters(value) {
  if (value == null || Number.isNaN(value)) return "?";
  return `${value.toFixed(2)} m`;
}

export default function FieldObject3D({ label, value, onChange }) {
  const inputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileSizeAsString, setFileSizeAsString] = useState(
    value?.fileSize ? stringifyFileSize(value.fileSize) : null
  );

  const hasModel = Boolean(value?.fileName);
  const bbox = value?.bbox;

  async function handleFile(file) {
    if (!file) return;
    const result = await processFile(file);
    if (!result) return;
    setFileSizeAsString(stringifyFileSize(result.size));
    onChange(result.entityField);
  }

  function handleBrowseClick() {
    inputRef.current?.click();
  }

  function handleInputChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    handleFile(file);
  }

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

  function handleDelete() {
    setFileSizeAsString(null);
    onChange(null);
  }

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold", color: "text.primary" }}>
          {label ?? "Objet 3D"}
        </Typography>

        {hasModel ? (
          <Box
            sx={{
              position: "relative",
              borderRadius: 1.5,
              p: 2,
              bgcolor: "action.hover",
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <ViewInAr sx={{ fontSize: 40, color: "primary.main" }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: "bold" }}
                noWrap
                title={value.fileName}
              >
                {value.fileName}
              </Typography>
              {bbox && (
                <Typography variant="caption" color="text.secondary">
                  {formatMeters(bbox.width)} × {formatMeters(bbox.height)} ×{" "}
                  {formatMeters(bbox.depth)}
                </Typography>
              )}
            </Box>

            <IconButton
              size="small"
              onClick={handleDelete}
              sx={{
                bgcolor: "background.paper",
                boxShadow: 1,
                "&:hover": { bgcolor: "error.light", color: "error.contrastText" },
              }}
            >
              <Delete sx={{ fontSize: 16 }} />
            </IconButton>

            {fileSizeAsString && (
              <Chip
                label={fileSizeAsString}
                size="small"
                sx={{
                  position: "absolute",
                  bottom: 6,
                  right: 6,
                  fontSize: "0.7rem",
                  bgcolor: "background.paper",
                  boxShadow: 1,
                }}
              />
            )}
          </Box>
        ) : (
          <>
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
                gap: 1,
              }}
              onClick={handleBrowseClick}
            >
              <ViewInAr sx={{ color: "text.disabled" }} />
              <Typography variant="caption" color="text.disabled">
                Glisser un fichier .glb
              </Typography>
            </Box>

            <Box sx={{ display: "flex", justifyContent: "space-between", px: 0.5 }}>
              <Typography
                variant="body2"
                onClick={handleBrowseClick}
                sx={{ cursor: "pointer", "&:hover": { color: "primary.main" } }}
              >
                Parcourir
              </Typography>
            </Box>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".glb,model/gltf-binary"
          style={{ display: "none" }}
          onChange={handleInputChange}
        />
      </Box>
    </WhiteSectionGeneric>
  );
}
