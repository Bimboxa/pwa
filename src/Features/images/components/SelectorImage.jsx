import { useState } from "react";

import { Box, IconButton } from "@mui/material";
import { Close } from "@mui/icons-material";

import BoxCenter from "Features/layout/components/BoxCenter";
import ContainerFilesSelector from "Features/files/components/ContainerFilesSelector";

import testIsPdf from "Features/pdf/utils/testIsPdf";
import pdfToPngAsync from "Features/pdf/utils/pdfToPngAsync";

export default function SelectorImage({ onImageFileChange }) {
  // strings

  const labelS = "Glisser déposer une image ou un PDF";

  // state

  const [imageUrl, setImageUrl] = useState(null);

  // handlers

  async function handleFilesChange(files) {
    console.log("files_", files);
    if (files) {
      let file0 = files[0];
      if (testIsPdf(file0)) {
        file0 = await pdfToPngAsync({ pdfFile: file0 });
      }
      console.log("file0", file0);
      setImageUrl(URL.createObjectURL(file0));
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
            top: 0,
            right: 0,
            zIndex: 2,
            bgcolor: "white",
            borderRadius: "50%",
          }}
        >
          <IconButton onClick={handleReset}>
            <Close />
          </IconButton>
        </Box>
      )}
      {imageUrl && (
        <Box
          sx={{
            position: "absolute",
            width: 1,
            height: 1,
            zIndex: 1,
            display: "flex",
            bgcolor: "background.default",
          }}
        >
          <img
            src={imageUrl}
            width={"100%"}
            style={{
              zIndex: 1,
              objectFit: "contain",
            }}
          />
        </Box>
      )}
      <ContainerFilesSelector
        onFilesChange={handleFilesChange}
        callToActionLabel={labelS}
        accept=".png, .jpeg, .pdf"
      />
    </BoxCenter>
  );
}
