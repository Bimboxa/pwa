import { useEffect } from "react";

import { Box, Typography } from "@mui/material";

export default function SelectorVariantChips({ options, selection, onChange }) {
  // handlers

  function handleClick(option) {
    console.log("click option", option);
    const newSelection = [option.key];
    onChange(newSelection);
  }

  // effect

  useEffect(() => {
    if (!selection?.length > 0 && options?.length > 0) {
      onChange([options[0].key]);
    }
  }, [options?.length, selection?.length]);

  return (
    <Box
      sx={{
        p: 1,
        display: "flex",
        flexWrap: "wrap",
        "&>*:not(last-child)": { mr: 1, mb: 0.5 },
      }}
    >
      {options?.map((option) => {
        const selected = selection.includes(option.key);
        return (
          <Box
            size="small"
            key={option.key}
            sx={{
              bgcolor: selected ? "secondary.main" : "default",
              color: selected ? "white" : "text.secondary",
              borderRadius: "8px",
              px: 0.5,
              cursor: "pointer",
            }}
            label={option.label}
            onClick={() => handleClick(option)}
          >
            <Typography variant="caption" noWrap>
              {option.label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
