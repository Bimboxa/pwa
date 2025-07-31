import { useState, useEffect } from "react";

import { Grid, TextField, Typography, Button } from "@mui/material";
import FieldDataObject from "Features/form/components/FieldDataObject";

export default function BlockEditableAppConfigItem({ item }) {
  // strings

  const saveS = "Enregistrer";

  // helpers

  const { key, label, value, prefix } = item;

  // data - func

  //const createOrUpdate = useCreateOrUpdateCredentialService();

  // state

  const [tempValue, setTempValue] = useState(value ?? "");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTempValue(value ?? "");
    return () => {
      setLoading(false);
      setTempValue("");
    };
  }, [key]);

  // helpers

  const disabledSave = loading;

  // handlers

  function handleChange(e) {
    setTempValue(e.target.value);
  }

  async function handleSaveClick() {
    try {
      if (loading) return;
      setLoading(true);
      //await createOrUpdate({key, prefix, value: tempValue});
      setLoading(false);
    } catch (e) {
      console.log("error", e);
    }
  }

  return (
    <Grid container spacing={2}>
      <Grid
        size={4}
        sx={{
          display: "flex",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Grid>
      <Grid size={8}>
        <FieldDataObject
          value={tempValue}
          onChange={handleChange}
          fullWidth
          variant="outlined"
        />
      </Grid>
    </Grid>
  );
}
