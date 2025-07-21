import { useState } from "react";

import { Typography, TextField, Button, Box } from "@mui/material";

import FieldPhoneNumber from "Features/form/components/FieldPhoneNumber";

import getMFACodeService from "../services/getMFACodeService";

export default function SectionStepPhoneNumber({ onSuccess }) {
  // strings

  const descriptionS = "Saisissez votre numéro de téléphone professionnel.";
  const sendS = "Envoyer";

  // state

  const [phoneNumber, setPhoneNumber] = useState("0685631098");

  // handlers

  async function handleSend() {
    await getMFACodeService({ phoneNumber });
    //
    if (onSuccess) onSuccess({ phoneNumber });
    //
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary">
        {descriptionS}
      </Typography>
      <Box sx={{ display: "flex", mt: 4 }}>
        <FieldPhoneNumber value={phoneNumber} onChange={setPhoneNumber} />
        <Button
          color="secondary"
          sx={{ ml: 1 }}
          variant="contained"
          onClick={handleSend}
        >
          <Typography>{sendS}</Typography>
        </Button>
      </Box>
    </Box>
  );
}
