import { useState, useEffect } from "react";

import { Box, Typography } from "@mui/material";
import FieldTextV2 from "./FieldTextV2";

function getMetadataHash(metadata) {
  if (!metadata) return "";
  return metadata.reduce((ac, cur) => {
    ac = ac + cur.key + cur.value ?? "";
    return ac;
  }, "");
}
export default function FieldMetadata({ value, onChange, label }) {
  console.log("debug_2309 metadata", value);

  // handlers

  function handleKeyValueChange(dataKey, dataValue) {
    const newValue = value.map((data) => {
      if (data.key === dataKey) {
        return { ...data, value: dataValue };
      } else {
        return data;
      }
    });
    onChange(newValue);
  }
  return (
    <Box sx={{ width: 1 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 1,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {label}
        </Typography>
      </Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          p: 1,
          flexDirection: "column",
          gap: 2,
        }}
      >
        {value?.map(({ key, value: _value, label: _label }) => {
          return (
            <FieldTextV2
              key={key}
              value={_value}
              label={_label}
              onChange={(newValue) => handleKeyValueChange(key, newValue)}
              options={{
                fullWidth: true,
                showLabel: true,
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
}
