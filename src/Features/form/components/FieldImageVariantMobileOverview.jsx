import {Typography, Box} from "@mui/material";
import ImageIcon from "@mui/icons-material/Image";

import BoxCenter from "Features/layout/components/BoxCenter";

export default function FieldImageVariantMobileOverview({label, value}) {
  // helpers

  const imageSrc = value?.imageUrlClient;

  return (
    <Box sx={{width: 1}}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={label}
          style={{width: "100%", height: "auto"}}
        />
      ) : (
        <BoxCenter>
          <Typography>{"-"}</Typography>
        </BoxCenter>
      )}
    </Box>
  );
}
