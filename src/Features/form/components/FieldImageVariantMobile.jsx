import {useRef, useEffect} from "react";

import {Box} from "@mui/material";
import {Image as ImageIcon} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonBasicMobile from "Features/layout/components/ButtonBasicMobile";
import BoxCenter from "Features/layout/components/BoxCenter";

export default function FieldImageVariantMobile({label, value, onChange}) {
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
      const imageObject = {imageUrlClient};
      onChange(imageObject);
    }
  }

  return (
    <BoxFlexVStretch>
      <BoxCenter sx={{position: "relative", width: 1}}>
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={label}
            style={{width: "100%", height: "auto"}}
          />
        ) : (
          <ImageIcon sx={{fontSize: 420, color: "text.secondary"}} />
        )}
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
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
    </BoxFlexVStretch>
  );
}
