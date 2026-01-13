import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Box, Typography, Grid } from "@mui/material";
import { Image as ImageIcon } from "@mui/icons-material";

import SelectorImage from "Features/images/components/SelectorImage";
import PanelPdfConverter from "Features/pdf/components/PanelPdfConverter";
import FieldCheck from "Features/form/components/FieldCheck";

import testIsPngImage from "Features/files/utils/testIsPngImage";
import getImageSizeAsync from "Features/misc/utils/getImageSize";
import resizeImageToLowResolution from "Features/images/utils/resizeImageToLowResolution";
import ImageObject from "Features/images/js/ImageObject";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";

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
  const showAsSection = options?.showAsSection;

  // strings

  const takePictureS = buttonLabel ?? "Prendre une photo";

  // state

  const [fileSizeAsString, setFileSizeAsString] = useState(null);
  const [applyMaxSize, setApplyMaxSize] = useState(true);

  // helpers

  const imageSrc = value?.imageUrlClient;

  // helpers - file size

  const sizeLabel = `Taille finale: ${fileSizeAsString}`;
  const maxSizeLabel = `Compresser si > ${stringifyFileSize(maxSize * 1024)}`;

  // helpers - func

  async function handleImageFileChange(file) {
    console.log("debug_1707 handleImageFileChange", maxSize, file);

    if (!file) return onChange(null);

    if (maxSize && file && applyMaxSize) {
      file = await resizeImageToLowResolution(file, maxSize * 1024);
    }
    setFileSizeAsString(stringifyFileSize(file.size));
    const imageObject = await ImageObject.create({ imageFile: file });
    onChange(imageObject.toEntityField());
  }

  return (
    <Box sx={{ width: 1 }}>
      {showAsSection && (
        <Box
          sx={{
            p: 1,
            borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {label}
          </Typography>
        </Box>
      )}

      <Box sx={{ p: 1, pb: maxSize ? 0 : 1 }}>
        <Box
          sx={{
            //border: (theme) => `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
          }}
        >
          <SelectorImage
            selectedImageUrl={imageSrc}
            onImageFileChange={handleImageFileChange}
          />
        </Box>
      </Box>

      {maxSize && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {maxSize && (
            <FieldCheck
              label={maxSizeLabel}
              value={applyMaxSize}
              onChange={(value) => setApplyMaxSize(value)}
              options={{
                textColor: "text.secondary",
              }}
            />
          )}
          {/* {fileSizeAsString && (
            <Typography
              variant="body2"
              sx={{ fontSize: 12, color: "text.secondary", px: 2 }}
            >
              {sizeLabel}
            </Typography>
          )} */}
        </Box>
      )}
    </Box>
  );
}
