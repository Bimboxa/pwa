import React, {useState} from "react";
import {TextField, InputAdornment, IconButton} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
}) {
  const [focused, setFocused] = useState(false);

  const handleClear = () => {
    onChange("");
  };

  return (
    <TextField
      variant="outlined"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
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
  );
}
