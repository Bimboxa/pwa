import { useRef, useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";

import GridImagesClickable from "Features/images/components/GridImagesClickable";

export default function FieldImageKeyFromOptions({
  value,
  onChange,
  label,
  options,
}) {
  const ref = useRef(null);

  // options

  const images = options?.images ?? [];
  const columns = options?.columns ?? 2;

  // state

  const [containerWidth, setContainerWidth] = useState(0);

  // effect

  useEffect(() => {
    if (ref.current) {
      setContainerWidth(ref.current.getBoundingClientRect().width);
    }
  }, [ref.current]);

  // helpers

  const selectedUrl = images?.find((image) => image.key === value)?.url;

  // handlers

  function handleImageClick(image) {
    const key = images.find((option) => option.url === image.url)?.key;
    onChange(key);
  }

  return (
    <Box sx={{ width: 1 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 1,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {label}
        </Typography>
      </Box>
      <Box
        ref={ref}
        sx={{ display: "flex", justifyContent: "center", width: 1 }}
      >
        <GridImagesClickable
          selectedUrl={selectedUrl}
          images={images}
          columns={columns}
          onClick={handleImageClick}
          containerWidth={containerWidth}
        />
      </Box>
    </Box>
  );
}
