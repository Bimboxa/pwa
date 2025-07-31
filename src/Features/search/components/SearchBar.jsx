import { useState, useRef } from "react";

import { Box, TextField, InputAdornment, IconButton } from "@mui/material";
import {
  Add as AddIcon,
  Search as SearchIcon,
  Close as CloseIcon,
} from "@mui/icons-material";

export default function SearchBar({
  value,
  onChange,
  onCreateClick,
  color,
  placeholder = "Recherche...",
}) {
  const [focused, setFocused] = useState(false);
  const blurTimeout = useRef(null);

  const handleClear = (e) => {
    e.preventDefault(); // empêche le focus de partir du bouton
    e.stopPropagation();
    onChange("");
  };

  const handleBlur = () => {
    // retarde la perte de focus pour laisser le clic se terminer
    blurTimeout.current = setTimeout(() => {
      setFocused(false);
    }, 100);
  };

  const handleFocus = () => {
    if (blurTimeout.current) {
      clearTimeout(blurTimeout.current);
    }
    setFocused(true);
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <TextField
        variant="outlined"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        fullWidth={focused}
        size="small"
        InputProps={{
          startAdornment: !focused && (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
          endAdornment: value && (
            <InputAdornment position="end">
              <IconButton onClick={handleClear} size="small">
                <CloseIcon />
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={{
          transition: "width 0.3s ease",
          minWidth: focused ? "100%" : "200px",
        }}
      />
      {onCreateClick && (
        <Box
          sx={{
            ml: 1,
            bgcolor: color ?? "secondary.main",
            display: focused ? "none" : "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
          }}
        >
          <IconButton onClick={onCreateClick}>
            <AddIcon sx={{ color: "white" }} />
          </IconButton>
        </Box>
      )}
    </Box>
  );
}
