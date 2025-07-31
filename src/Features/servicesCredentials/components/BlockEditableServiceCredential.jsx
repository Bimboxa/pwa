import { useState, useEffect } from "react";

import { Grid, TextField, Typography, Button } from "@mui/material";

import useCreateOrUpdateCredentialService from "../hooks/useCreateOrUpdateCredentialService";

export default function BlockEditableServiceCredential({ serviceCredential }) {
  const serviceName = serviceCredential.serviceName;
  const label = serviceCredential.label;
  const value = serviceCredential.value;
  const key = serviceCredential.key;
  const prefix = serviceCredential.prefix;

  // strings

  const saveS = "Enregistrer";

  // data - func

  const createOrUpdate = useCreateOrUpdateCredentialService();

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
      await createOrUpdate({ key, prefix, value: tempValue });
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
        <Typography variant="body2">{serviceName}</Typography>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Grid>
      <Grid size={6}>
        <TextField
          type={"password"}
          value={tempValue}
          onChange={handleChange}
          fullWidth
          variant="outlined"
        />
      </Grid>
      <Grid size={2} sx={{ display: "flex", alignItems: "center" }}>
        <Button
          disabled={disabledSave}
          variant="contained"
          color="secondary"
          onClick={handleSaveClick}
        >
          {saveS}
        </Button>
      </Grid>
    </Grid>
  );
}
