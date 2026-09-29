import { useState } from "react";

import { Box } from "@mui/material";
import { AutoAwesome } from "@mui/icons-material";

import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import DialogPromptIaProject from "./DialogPromptIaProject";

export default function ButtonPromptIaProject({
  project,
  onProjectChange,
  onCreated,
  disabled,
}) {
  // strings

  const labelS = "Prompt IA";

  // state

  const [open, setOpen] = useState(false);

  // render

  return (
    <Box sx={{ display: "flex", justifyContent: "center", pb: 1 }}>
      <ButtonGeneric
        label={labelS}
        onClick={() => setOpen(true)}
        size="small"
        variant="text"
        color="inherit"
        startIcon={<AutoAwesome sx={{ fontSize: 16 }} />}
        disabled={disabled}
        sx={{ color: "text.secondary" }}
      />
      <DialogPromptIaProject
        open={open}
        onClose={() => setOpen(false)}
        project={project}
        onProjectChange={onProjectChange}
        onCreated={onCreated}
      />
    </Box>
  );
}
