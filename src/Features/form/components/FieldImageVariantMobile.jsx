import {useRef, useEffect} from "react";

import {Box, IconButton, Button, Paper} from "@mui/material";
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

  // strings

  const takePictureS = "Prendre une photo";

  // effect - init

  useEffect(() => {
    //if (!value) handleClick();
  }, []);

  // helpers

  const imageSrc = value?.imageUrlClient;
  console.log("imageSrc", imageSrc);

  // handlers

  function handleClick() {
    inputRef.current.click();
  }

  async function handleChange(event) {
    const file = event.target.files[0];

    if (maxSize) file = await resizeImageToLowResolution(file, maxSize * 1024);

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
    <BoxFlexVStretch>
      <BoxCenter sx={{position: "relative", width: 1}}>
        <Box sx={{width: 1, height: "70%", p: 2, position: "relative"}}>
          <Paper sx={{height: 1, width: 1}}>
            {imageSrc && (
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
              {takePictureS}
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
