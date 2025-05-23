import {useRef, useEffect, useState} from "react";

import {
  Box,
  IconButton,
  Typography,
  Button,
  Paper,
  CircularProgress,
} from "@mui/material";
import {Image as ImageIcon} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonBasicMobile from "Features/layout/components/ButtonBasicMobile";
import BoxCenter from "Features/layout/components/BoxCenter";
import testIsPngImage from "Features/files/utils/testIsPngImage";
import getImageSizeAsync from "Features/misc/utils/getImageSize";
import resizeImageToLowResolution from "Features/images/utils/resizeImageToLowResolution";

export default function FieldImageVariantMobile({
  label,
  value,
  onChange,
  options,
}) {
  const inputRef = useRef(null);

  // options

  const maxSize = options?.maxSize;

  // state

  const [loading, setLoading] = useState(false);

  // strings

  const takePictureS = "Prendre une photo";

  // effect - init

  useEffect(() => {
    if (!value) handleClick();
  }, []);

  // helpers

  const imageSrc = value?.imageUrlClient;
  console.log("imageSrc", imageSrc);

  // handlers

  function handleClick() {
    inputRef.current.click();
  }

  async function handleChange(event) {
    let file = event.target.files[0];

    if (maxSize) {
      setLoading(true);
      file = await resizeImageToLowResolution(file, maxSize * 1024);
      setLoading(false);
    }

    const imageUrlClient = URL.createObjectURL(file);
    const isImage = testIsPngImage(file);
    if (file && isImage) {
      const imageObject = {
        imageUrlClient,
        file,
        imageSize: await getImageSizeAsync({file}),
      };
      onChange(imageObject);
    }
  }

  return (
    <BoxFlexVStretch sx={{}}>
      <BoxCenter sx={{position: "relative", width: 1}}>
        <Box sx={{width: 1, height: "70%", p: 2, position: "relative"}}>
          <Paper
            sx={{
              height: 1,
              width: 1,
              bgcolor: "background.default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
            }}
          >
            {imageSrc && !loading && (
              <img
                src={imageSrc}
                alt={label}
                style={{
                  objectFit: "contain",
                  width: "100%",
                  maxHeight: "100%",
                }}
              />
            )}
            {loading && <CircularProgress />}
          </Paper>
          <Box
            sx={{
              position: "absolute",
              bottom: "16px",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <Button
              onClick={handleClick}
              startIcon={<ImageIcon />}
              variant="contained"
            >
              <Typography noWrap variant="body2">
                {takePictureS}
              </Typography>
            </Button>
          </Box>
        </Box>
      </BoxCenter>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{display: "none"}}
        onChange={handleChange}
      />
    </BoxFlexVStretch>
  );
}
