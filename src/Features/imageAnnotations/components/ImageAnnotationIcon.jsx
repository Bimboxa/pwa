import { Box, Typography } from "@mui/material";

export default function ImageAnnotationIcon({ image, size = 24 }) {
  // helpers - sprite image

  const imageUrl = image?.imageUrlClient;

  if (!imageUrl)
    return (
      <Box
        sx={{
          width: `${size}px`,
          height: `${size}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography>?</Typography>
      </Box>
    );
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "1px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        border: (theme) => `1px solid ${theme.palette.divider}`,
        //overflow: "hidden",
      }}
    />
  );
}
