import {Typography, Box, Paper} from "@mui/material";

import BoxCenter from "Features/layout/components/BoxCenter";

export default function FieldImageVariantMobileOverview({label, value}) {
  // helpers

  const imageSrc = value?.imageUrlClient;

  return (
    <Box sx={{width: 1}}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Box sx={{p: 1}}>
        <Paper>
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={label}
              style={{width: "100%", maxHeight: "400px", objectFit: "contain"}}
            />
          ) : (
            <BoxCenter>
              <Typography>{"-"}</Typography>
            </BoxCenter>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
