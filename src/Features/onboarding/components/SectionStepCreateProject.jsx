import { useState } from "react";
import { Box, TextField } from "@mui/material";

export default function SectionStepCreateProject() {
  // strings

  const title = "Nom de votre projet";

  const description = `Tous vos plans de repérage sont organisés par projet.`;

  // state

  const [tempName, setTempName] = useState("");

  // handlers

  function handleChange(e) {
    setTempName(e.target.value);
  }

  function handleSubmit(e) {
    e.preventDefault();
  }

  // render

  return (
    <Box>
      <TextField value={tempName} onChange={handleChange} />
    </Box>
  );
}
