import { useState } from "react";

import { Box, IconButton, Typography } from "@mui/material";
import { Delete } from "@mui/icons-material";

import BoxCenter from "Features/layout/components/BoxCenter";
import ContainerFilesSelector from "Features/files/components/ContainerFilesSelector";

import testIsPdf from "Features/pdf/utils/testIsPdf";
import pdfToPngAsync from "Features/pdf/utils/pdfToPngAsync";

import ImageObject from "../js/ImageObject";

export default function SelectorImage({ onImageFileChange }) {
  // strings

  const labelS = "Glisser déposer une image ou un PDF";

  // state

  const [imageUrl, setImageUrl] = useState(null);
  const [imageObject, setImageObject] = useState(null);

  // handlers

  async function handleFilesChange(files) {
    console.log("files_", files);
    if (files) {
      let file0 = files[0];
      if (testIsPdf(file0)) {
        file0 = await pdfToPngAsync({ pdfFile: file0 });
      }
      setImageUrl(URL.createObjectURL(file0));

      const _imageObject = await ImageObject.create({ imageFile: file0 });
      setImageObject(_imageObject);
      onImageFileChange(file0);
    }
  }

  function handleReset() {
    onImageFileChange(null);
    setImageUrl(null);
  }

  return (
    <BoxCenter sx={{ position: "relative" }}>
      {imageUrl && (
        <Box
          sx={{
            position: "absolute",
            top: "8px",
            right: "8px",
            zIndex: 2,
            bgcolor: "white",
            borderRadius: "50%",
            border: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          <IconButton onClick={handleReset}>
            <Delete />
          </IconButton>
        </Box>
      )}
      {imageUrl && (
        <Box
          sx={{
            px: 0.5,
            position: "absolute",
            bottom: "8px",
            left: "8px",
            zIndex: 2,
            bgcolor: "white",
            borderRadius: "8px",
            border: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="caption">
            {imageObject?.getFileSizeAsString()}
          </Typography>
        </Box>
      )}
      {imageUrl && (
        <Box
          sx={{
            //position: "absolute",
            width: 1,
            //height: 1,
            zIndex: 1,
            display: "flex",
            bgcolor: "background.default",
          }}
        >
          <img
            src={imageUrl}
            style={{
              width: "100%",
              height: "auto",
              zIndex: 1,
              //objectFit: "contain",
              objectFit: "contain",
            }}
          />
        </Box>
      )}
      {!imageUrl && (
        <ContainerFilesSelector
          onFilesChange={handleFilesChange}
          callToActionLabel={labelS}
          accept=".png, .jpeg, .pdf"
        />
      )}
    </BoxCenter>
  );
}
