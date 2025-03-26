import {useRef, useEffect} from "react";

import {Box, Typography, Grid2} from "@mui/material";
import {Image as ImageIcon} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonBasicMobile from "Features/layout/components/ButtonBasicMobile";
import BoxCenter from "Features/layout/components/BoxCenter";

export default function FieldImageVariantGrid({
  label,
  value,
  onChange,
  size = 8,
}) {
  const inputRef = useRef(null);

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

  function handleChange(event) {
    const file = event.target.files[0];
    const imageUrlClient = URL.createObjectURL(file);
    if (file) {
      const imageObject = {imageUrlClient, file};
      onChange(imageObject);
    }
  }

  return (
    <Grid2
      container
      sx={{border: (theme) => `1px solid ${theme.palette.divider}`}}
    >
      <Grid2
        size={12 - size}
        sx={{
          bgcolor: "background.default",
          p: 1,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Grid2>
      <Grid2 size={size}>
        <BoxCenter sx={{position: "relative", width: 1, minHeight: 100}}>
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={label}
              style={{width: "100%", height: "auto"}}
            />
          ) : (
            <ImageIcon sx={{fontSize: 100, color: "text.secondary"}} />
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
          accept="image/*"
          capture="environment"
          style={{display: "none"}}
          onChange={handleChange}
        />
      </Grid2>
    </Grid2>
  );
}
