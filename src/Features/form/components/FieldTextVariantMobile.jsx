import {useState, useEffect} from "react";

import {Typography, Box, Button} from "@mui/material";
import FieldText from "./FieldText";

export default function FieldTextVariantMobile({
  value,
  onChange,
  options,
  label,
}) {
  console.log("[FieldTextVariantMobile] autoFocus", options?.autoFocus);

  // string

  const saveS = "Enregistrer";

  // state

  const [tempText, setTempText] = useState(value);
  useEffect(() => {
    setTempText(value);
  }, [value]);

  // handlers

  function handleSave() {
    onChange(tempText);
  }

  function handleChange(newValue) {
    setTempText(newValue);
  }

  return (
    <Box sx={{width: 1, p: 2, overflow: "auto", flexGrow: 1}}>
      <Box
        sx={{
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography>{label}</Typography>
      </Box>

      <FieldText
        value={value}
        onChange={handleChange}
        options={{...options, fullWidth: true, autoFocus: true, hideMic: true}}
        label={label}
      />
      <Box sx={{display: "flex", justifyContent: "end", p: 1}}>
        <Button size="large" onClick={handleSave} variant="contained">
          {saveS}
        </Button>
      </Box>
    </Box>
  );
}
