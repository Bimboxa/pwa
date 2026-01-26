import { useState, useEffect } from "react";

import { useDispatch } from "react-redux";

import { setOpenBaseMapCreator, setPdfFile } from "Features/baseMapCreator/baseMapCreatorSlice";

import { Box, IconButton, Typography } from "@mui/material";
import { Delete } from "@mui/icons-material";

import BoxCenter from "Features/layout/components/BoxCenter";
import ContainerFilesSelector from "Features/files/components/ContainerFilesSelector";

import testIsPdf from "Features/pdf/utils/testIsPdf";
import pdfToPngAsync from "Features/pdf/utils/pdfToPngAsync";

import ImageObject from "../js/ImageObject";
import testIsImage from "Features/files/utils/testIsImage";


export default function SelectorImage({
  selectedImageUrl,
  onImageFileChange,
  bgImageUrl,
  bgColor,
  variant, // "BASE_MAP_CREATOR" | "DEFAULT"
}) {
  const dispatch = useDispatch();

  // strings

  const labelS = "Glisser déposer une image ou un PDF";

  // state

  const [imageUrl, setImageUrl] = useState(null);
  const [imageObject, setImageObject] = useState(null);

  // effect

  useEffect(() => {
    setImageUrl(selectedImageUrl);
  }, [selectedImageUrl]);

  // handlers

  async function handleFilesChange(files) {
    console.log("files_", files);
    if (files) {
      let file0 = files[0];
      if (testIsPdf(file0)) {
        if (variant === "BASE_MAP_CREATOR") {
          dispatch(setOpenBaseMapCreator(true));
          dispatch(setPdfFile(file0));
        } else {
          const { imageFile } = await pdfToPngAsync({ pdfFile: file0 });
          file0 = imageFile;
          onImageFileChange(file0);
        }
      }

      else if (testIsImage(file0)) {
        setImageUrl(URL.createObjectURL(file0));

        const _imageObject = await ImageObject.create({ imageFile: file0 });
        setImageObject(_imageObject);
        onImageFileChange(file0);
      }

    }
  }

  function handleReset() {
    onImageFileChange(null);
    setImageUrl(null);
  }

  return (
    <BoxCenter
      sx={{
        position: "relative",
        border: (theme) => `1px solid ${theme.palette.divider}`,
        borderRadius: "8px",
        ...(bgColor && { bgcolor: bgColor }),
      }}
    >
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
            height: 1,
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
              maxHeight: "100%",
              zIndex: 1,
              //objectFit: "contain",
              objectFit: "contain",

              borderRadius: "8px",
            }}
          />
        </Box>
      )}
      {!imageUrl && (
        <Box
          sx={{
            width: 1,
            height: 1,
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {bgImageUrl && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",

                //zIndex: 1,
              }}
            >
              <img
                src={bgImageUrl}
                style={{
                  width: "100%",
                  height: "auto",
                  maxHeight: "100%",
                  objectFit: "contain",
                  //objectFit: "fill",
                }}
              />
            </Box>
          )}
          <ContainerFilesSelector
            onFilesChange={handleFilesChange}
            callToActionLabel={labelS}
            accept=".png, .jpeg, .pdf"
          />
        </Box>
      )}
    </BoxCenter>
  );
}
