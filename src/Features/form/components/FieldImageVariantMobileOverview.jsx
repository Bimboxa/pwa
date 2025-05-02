import {Typography, Box, Paper} from "@mui/material";

import BoxCenter from "Features/layout/components/BoxCenter";

export default function FieldImageVariantMobileOverview({label, value}) {
  // string

  const addS = "Aucune image";

  // helpers

  const imageSrc = value?.imageUrlClient;

  return (
    <Box sx={{width: 1}}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Box sx={{p: 1, width: 1}}>
        {imageSrc ? (
          <Paper sx={{width: 1, display: "flex"}}>
            <img
              src={imageSrc}
              alt={label}
              style={{
                borderRadius: "4px",
                width: "100%",
                maxHeight: "400px",
                objectFit: "contain",
              }}
            />
          </Paper>
        ) : (
          <BoxCenter sx={{p: 2}}>
            <Typography color="text.secondary" variant="body2">
              {addS}
            </Typography>
          </BoxCenter>
        )}
      </Box>
    </Box>
  );
}
