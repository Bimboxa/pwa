import { useState } from "react";

import { Typography, TextField, Button, Box } from "@mui/material";

import FieldPhoneNumber from "Features/form/components/FieldPhoneNumber";

import getMFACodeService from "../services/getMFACodeService";

import getAppConfigDefault from "Features/appConfig/services/getAppConfigDefault";

export default function SectionStepPhoneNumber({ onSuccess }) {
  // strings

  const descriptionS =
    "Saisissez votre numéro de téléphone professionnel pour recevoir par sms le code de connexion.";
  const sendS = "Envoyer";

  // state

  const [phoneNumber, setPhoneNumber] = useState("0685631098");

  // handlers

  async function handleSend() {
    try {
      const appConfig = await getAppConfigDefault();
      const serviceUrl = appConfig?.auth?.getMfaCodeUrl;
      const number = await getMFACodeService({ phoneNumber, serviceUrl });
      console.log("request MFA for phone number", number);
      //
      if (onSuccess && number) onSuccess({ phoneNumber: number });
    } catch (e) {
      console.log("error", e);
    }
    //
  }

  return (
    <Box>
      <Box sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {descriptionS}
        </Typography>
      </Box>

      <Box sx={{ mt: 4, display: "flex" }}>
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
