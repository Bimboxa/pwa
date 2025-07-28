import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Box, Typography, Grid2 } from "@mui/material";
import { Image as ImageIcon } from "@mui/icons-material";

import SelectorImage from "Features/images/components/SelectorImage";
import PanelPdfConverter from "Features/pdf/components/PanelPdfConverter";

import testIsPngImage from "Features/files/utils/testIsPngImage";
import getImageSizeAsync from "Features/misc/utils/getImageSize";
import resizeImageToLowResolution from "Features/images/utils/resizeImageToLowResolution";
import ImageObject from "Features/images/js/ImageObject";

export default function FieldImageV2({
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
    const imageObject = await ImageObject.create(file);
    onChange(imageObject);
  }

  return (
    <Box sx={{ width: 1, p: 1 }}>
      <Box
        sx={{
          border: (theme) => `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
        }}
      >
        <SelectorImage onImageFileChange={handleImageFileChange} />
      </Box>
    </Box>
  );
}
