import { useRef, useEffect } from "react";

import { Box, Typography, Grid, IconButton, Tooltip } from "@mui/material";
import { Image as ImageIcon, Download, Upload } from "@mui/icons-material";

import IconButtonUploadFile from "Features/files/components/IconButtonUploadFile";

export default function FieldDataObject({ label, value, onChange, size = 8 }) {
  const inputRef = useRef(null);

  // strings

  const downloadS = "Télécharger";
  const uploadS = "Uploader un fichier";

  // effect - init

  useEffect(() => {
    //if (!value) handleClick();
  }, []);

  // helpers

  const dataObjectLabel = value?.src?.name ?? "-?-";

  // handlers

  function handleFileChange(file) {
    console.log("file", file);
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography>{dataObjectLabel}</Typography>
      <Tooltip title={downloadS}>
        <IconButton>
          <Download />
        </IconButton>
      </Tooltip>
      <Tooltip title={uploadS}>
        <IconButtonUploadFile onChange={handleFileChange} />
      </Tooltip>
    </Box>
  );
}
