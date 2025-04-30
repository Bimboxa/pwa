import {useEffect, useRef} from "react";
import {
  Autocomplete,
  TextField,
  Box,
  Grid2,
  Typography,
  IconButton,
  InputAdornment,
} from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";

import FieldText from "./FieldText";

export default function FieldTextVariantGrid({
  value,
  onChange,
  options,
  label,
  size = 8,
}) {
  // helpers

  return (
    <Grid2
      container
      sx={{border: (theme) => `1px solid ${theme.palette.divider}`}}
    >
      <Grid2 size={12 - size} sx={{p: 1, bgcolor: "background.default"}}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Grid2>
      <Grid2 size={size}>
        <FieldText
          value={value}
          onChange={onChange}
          options={{
            fullWidth: true,
            ...options,
            hideMic: true,
            hideBorder: true,
          }}
          label={label}
        />
      </Grid2>
    </Grid2>
  );
}
