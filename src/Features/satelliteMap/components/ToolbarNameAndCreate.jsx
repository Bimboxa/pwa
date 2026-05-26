import { useState } from "react";

import { Paper, TextField } from "@mui/material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";

export default function ToolbarNameAndCreate({
  listing,
  onCreate,
  isCreating,
}) {
  // strings

  const placeholder = "Nom du fond de plan";
  const createS = "Créer";

  // state

  const [name, setName] = useState("");

  // helpers

  const disabled = name.length === 0 || isCreating;

  // handlers

  function handleNameChange(e) {
    setName(e.target.value);
  }

  function handleCreateClick() {
    onCreate?.({ name, listing });
  }

  // render

  return (
    <Paper
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        px: 2,
        py: 1,
      }}
    >
      <TextField
        size="small"
        placeholder={placeholder}
        value={name}
        onChange={handleNameChange}
      />
      <ButtonGeneric
        label={createS}
        variant="contained"
        color="secondary"
        disabled={disabled}
        loading={isCreating}
        onClick={handleCreateClick}
      />
    </Paper>
  );
}
