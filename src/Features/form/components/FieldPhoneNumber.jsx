import React from "react";
import TextField from "@mui/material/TextField";

// Helper to format French phone numbers: 06 61 42 26 67
function formatFrenchPhoneNumber(value) {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, "");
  // Group into pairs
  const pairs = digits.match(/.{1,2}/g) || [];
  // Join with spaces, limit to 10 digits (5 pairs)
  return pairs.slice(0, 5).join(" ");
}

export default function FieldPhoneNumber({ value, onChange, ...props }) {
  // strings

  const placeholder = "06 xx xx xx xx";

  // handlers

  const handleChange = (e) => {
    // Remove all non-digit characters from input
    const rawDigits = e.target.value.replace(/\D/g, "");
    // Pass only digits to parent
    onChange && onChange(rawDigits);
  };

  return (
    <TextField
      {...props}
      value={formatFrenchPhoneNumber(value || "")}
      onChange={handleChange}
      slotProps={{
        input: {
          inputMode: "numeric",
          pattern: "[0-9 ]*",
          maxLength: 14, // 12 digits + 2 spaces
          autoComplete: "tel",
        },
      }}
      label="Numéro de téléphone"
      placeholder={placeholder}
    />
  );
}
