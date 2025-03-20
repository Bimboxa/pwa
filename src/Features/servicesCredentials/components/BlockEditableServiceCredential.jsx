import {useState, useEffect} from "react";

import {Grid2, TextField, Typography, Button} from "@mui/material";

export default function BlockEditableServiceCredential({serviceCredential}) {
  const label = serviceCredential.label;
  const value = serviceCredential.value;

  // strings

  const saveS = "Enregistrer";

  // state

  const [tempValue, setTempValue] = useState(value ?? "");
  useEffect(() => {
    setTempValue(value);
  }, [value]);

  // handlers

  function handleChange(e) {
    setTempValue(e.target.value);
  }
  return (
    <Grid2 container spacing={2}>
      <Grid2 size={4} sx={{display: "flex", alignItems: "center"}}>
        <Typography variant="body2">{label}</Typography>
      </Grid2>
      <Grid2 size={6}>
        <TextField
          type={"password"}
          value={tempValue}
          onChange={handleChange}
          fullWidth
          variant="outlined"
        />
      </Grid2>
      <Grid2 size={2} sx={{display: "flex", alignItems: "center"}}>
        <Button variant="contained" color="secondary">
          {saveS}
        </Button>
      </Grid2>
    </Grid2>
  );
}
