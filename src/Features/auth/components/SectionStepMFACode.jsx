import { useState } from "react";

import { Box, Typography } from "@mui/material";

import FieldCode from "Features/form/components/FieldCode";
import verifyMFACodeService from "../services/verifyMFACodeService";

function formatFrenchPhoneNumber(value) {
  const digits = value.replace(/\D/g, "");
  const pairs = digits.match(/.{1,2}/g) || [];
  return pairs.slice(0, 5).join(" ");
}

export default function SectionStepMFACode({ phoneNumber, onSuccess }) {
  // state

  const [locked, setLocked] = useState(false);

  // helpers

  const descriptionS = `Code envoyé au ${formatFrenchPhoneNumber(phoneNumber)}`;

  // handlers

  async function handleCodeChange(code) {
    setLocked(true);
    const jwt = await verifyMFACodeService({ phoneNumber, mfaCode: code });
    onSuccess({ jwt });
  }

  function handleLockedChange(_locked) {
    setLocked(_locked);
  }
  // return

  return (
    <Box>
      <Typography sx={{ mb: 2 }} variant="body2" color="text.secondary">
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
