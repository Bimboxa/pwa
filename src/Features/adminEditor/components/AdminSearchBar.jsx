import { useState, useCallback } from "react";

import { useDispatch } from "react-redux";
import { setAdminSearchQuery } from "../adminEditorSlice";

import { Box, TextField, InputAdornment } from "@mui/material";
import { Search } from "@mui/icons-material";

export default function AdminSearchBar() {
  const dispatch = useDispatch();

  // state

  const [localValue, setLocalValue] = useState("");
  const [debounceTimer, setDebounceTimer] = useState(null);

  // handlers

  const handleChange = useCallback(
    (e) => {
      const value = e.target.value;
      setLocalValue(value);
      if (debounceTimer) clearTimeout(debounceTimer);
      const timer = setTimeout(() => {
        dispatch(setAdminSearchQuery(value));
      }, 200);
      setDebounceTimer(timer);
    },
    [dispatch, debounceTimer]
  );

  // render

  return (
    <Box sx={{ p: 1 }}>
      <TextField
        value={localValue}
        onChange={handleChange}
        placeholder="Search..."
        variant="outlined"
        size="small"
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          },
        }}
      />
    </Box>
  );
}
