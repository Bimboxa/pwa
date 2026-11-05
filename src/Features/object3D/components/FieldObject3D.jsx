import { useRef, useState } from "react";

import PropTypes from "prop-types";

import { Box, Typography, IconButton, Chip } from "@mui/material";
import { AutoAwesome, Delete, ViewInAr } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import DialogPromptIaObject3D from "./DialogPromptIaObject3D";

import createObject3DEntityField from "Features/object3D/utils/createObject3DEntityField";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";

async function processFile(file) {
  const entityField = await createObject3DEntityField(file);
  if (!entityField) {
    console.warn("[FieldObject3D] file is not a valid .glb", file?.name);
    return null;
  }
  return { entityField, size: file.size };
}

function formatMeters(value) {
  if (value == null || Number.isNaN(value)) return "?";
  return `${value.toFixed(2)} m`;
}

// `objectName` (the template label being edited) names the object in the
// Prompt IA zip.
export default function FieldObject3D({ label, value, onChange, objectName }) {
  const inputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [openPromptIa, setOpenPromptIa] = useState(false);
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
        <Typography
          variant="body2"
          sx={{ fontWeight: "bold", color: "text.primary" }}
        >
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
            {value?.topViewDataUrl ? (
              <Box
                component="img"
                src={value.topViewDataUrl}
                alt="Vue de dessus"
                sx={{
                  width: 48,
                  height: 48,
                  objectFit: "contain",
                  borderRadius: 1,
                  bgcolor: "background.paper",
                  boxShadow: 1,
                }}
              />
            ) : (
              <ViewInAr sx={{ fontSize: 40, color: "primary.main" }} />
            )}
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
                "&:hover": {
                  bgcolor: "error.light",
                  color: "error.contrastText",
                },
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

            <Box
              sx={{ display: "flex", justifyContent: "space-between", px: 0.5 }}
            >
              <Typography
                variant="body2"
                onClick={handleBrowseClick}
                sx={{ cursor: "pointer", "&:hover": { color: "primary.main" } }}
              >
                Parcourir
              </Typography>

              {/* No .glb at hand: have an external AI chat model the object */}
              <Typography
                variant="body2"
                onClick={() => setOpenPromptIa(true)}
                sx={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  "&:hover": { color: "primary.main" },
                }}
              >
                <AutoAwesome sx={{ fontSize: 14 }} />
                Prompt IA
              </Typography>
            </Box>
          </>
        )}

        <DialogPromptIaObject3D
          open={openPromptIa}
          onClose={() => setOpenPromptIa(false)}
          objectName={objectName}
        />

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

FieldObject3D.propTypes = {
  label: PropTypes.string,
  value: PropTypes.shape({
    fileName: PropTypes.string,
    fileSize: PropTypes.number,
    bbox: PropTypes.object,
    topViewDataUrl: PropTypes.string,
  }),
  onChange: PropTypes.func.isRequired,
  objectName: PropTypes.string,
};
