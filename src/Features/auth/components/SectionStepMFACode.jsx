import { useState, useRef } from "react";

import { Box, Typography } from "@mui/material";

import FieldCode from "Features/form/components/FieldCode";
import verifyMFACodeService from "../services/verifyMFACodeService";
import getAppConfigDefault from "Features/appConfig/services/getAppConfigDefault";

function formatFrenchPhoneNumber(value) {
  const digits = value.replace(/\D/g, "");
  const pairs = digits.match(/.{1,2}/g) || [];
  return pairs.slice(0, 5).join(" ");
}

export default function SectionStepMFACode({ phoneNumber, onSuccess }) {
  const verifyingRef = useRef();

  // state

  const [locked, setLocked] = useState(false);

  // helpers

  const descriptionS = `Saisissez le code envoyé au ${formatFrenchPhoneNumber(
    phoneNumber
  )}`;

  // handlers

  async function handleCodeChange(code) {
    if (verifyingRef.current) {
      console.log("...verifying");
      return;
    }
    setLocked(true);
    const appConfig = await getAppConfigDefault();
    const serviceUrl = appConfig.auth.verifyMfaCodeUrl;
    verifyingRef.current = true;
    const jwt = await verifyMFACodeService({
      phoneNumber,
      mfaCode: code,
      serviceUrl,
    });
    console.log("jwt", jwt);
    if (jwt) onSuccess({ jwt });
    verifyingRef.current = false;
  }

  function handleLockedChange(_locked) {
    setLocked(_locked);
  }
  // return

  return (
    <Box>
      <Typography sx={{ mb: 2, p: 4 }} variant="body2" color="text.secondary">
        {descriptionS}
      </Typography>
      <FieldCode
        digitsLength={6}
        onChange={handleCodeChange}
        locked={locked}
        onLockedChange={handleLockedChange}
      />
    </Box>
  );
}
