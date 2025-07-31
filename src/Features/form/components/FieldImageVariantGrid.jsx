import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Box, Typography, Grid } from "@mui/material";
import { Image as ImageIcon } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonBasicMobile from "Features/layout/components/ButtonBasicMobile";
import BoxCenter from "Features/layout/components/BoxCenter";
import PanelPdfConverter from "Features/pdf/components/PanelPdfConverter";

import testIsPngImage from "Features/files/utils/testIsPngImage";
import getImageSizeAsync from "Features/misc/utils/getImageSize";
import resizeImageToLowResolution from "Features/images/utils/resizeImageToLowResolution";

export default function FieldImageVariantGrid({
  label,
  value,
  onChange,
  size = 8,
  options,
  formContainerRef,
}) {
  const inputRef = useRef(null);

  // options

  const maxSize = options?.maxSize;
  const fromPdf = options?.fromPdf;
  const buttonLabel = options?.buttonLabel;

  // strings

  const takePictureS = buttonLabel ?? "Prendre une photo";

  // state

  const [openPdfConverter, setOpenPdfConverter] = useState(false);
  const [pdfFile, setPdfFile] = useState();

  // effect - init

  useEffect(() => {
    //if (!value) handleClick();
  }, []);

  // helpers

  const imageSrc = value?.imageUrlClient;
  console.log("imageSrc", imageSrc);

  // helpers - func

  async function handleImageFileChange(file) {
    if (maxSize) file = await resizeImageToLowResolution(file, maxSize * 1024);

    const imageUrlClient = URL.createObjectURL(file);

    const imageObject = {
      imageUrlClient,
      file,
      imageSize: await getImageSizeAsync({ file }),
      fileSize: file.size,
      isImage: true,
    };
    onChange(imageObject);
  }

  // handlers

  function handleClick() {
    inputRef.current.click();
  }

  async function handleChange(event) {
    let file = event.target.files[0];

    if (file.type === "application/pdf") {
      setOpenPdfConverter(true);
      setPdfFile(file);
    } else if (testIsPngImage(file)) {
      await handleImageFileChange(file);
    }
  }

  function handlePanelClose() {
    setOpenPdfConverter(false);
  }

  async function handleImageFileCreated(imageFile) {
    await handleImageFileChange(imageFile);
    setOpenPdfConverter(false);
  }

  return (
    <>
      {openPdfConverter &&
        createPortal(
          <Box
            sx={{
              position: "absolute",
              bgcolor: "white",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <PanelPdfConverter
              onClose={handlePanelClose}
              pdfFile={pdfFile}
              onImageFileCreated={handleImageFileCreated}
            />
          </Box>,
          formContainerRef.current
        )}
      <Grid
        container
        sx={{ border: (theme) => `1px solid ${theme.palette.divider}` }}
      >
        <Grid
          size={12 - size}
          sx={{
            bgcolor: "background.default",
            p: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        </Grid>
        <Grid size={size}>
          <BoxCenter sx={{ position: "relative", width: 1, minHeight: 100 }}>
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={label}
                style={{ width: "100%", height: "auto" }}
              />
            ) : (
              <ImageIcon sx={{ fontSize: 100, color: "text.secondary" }} />
            )}
            <Box
              sx={{
                position: "absolute",
                bottom: "16px",
                left: "50%",
                transform: "translateX(-50%)",
                width: 1,
              }}
            >
              <ButtonBasicMobile label={takePictureS} onClick={handleClick} />
            </Box>
          </BoxCenter>

          <input
            ref={inputRef}
            type="file"
            accept="image/*, application/pdf"
            capture="environment"
            style={{ display: "none" }}
            onChange={handleChange}
          />
        </Grid>
      </Grid>
    </>
  );
}
