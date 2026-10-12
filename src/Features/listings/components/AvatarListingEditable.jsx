import { useState } from "react";

import { Box, InputBase, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { getDefaultListingAvatarString } from "../utils/getListingAvatarString";

// ---------------------------------------------------------------------------
// AvatarListingEditable — the listing avatar as the edit point of its avatar
// string: the round "selected" avatar hosts a 3-char input, so clicking it
// shows the caret and the letters are typed in place. Empty = automatic
// initials derived from `name`, shown as the placeholder only while the
// field is not focused: during the edit the avatar can be fully cleared,
// the fallback applies at the commit (blur). Fully controlled through
// `avatarString` / `onChange`; Enter / Escape blur without bubbling to the
// parent form.
// ---------------------------------------------------------------------------

export default function AvatarListingEditable({
  name,
  avatarString,
  onChange,
  size = 32,
  disabled = false,
  sx,
}) {
  // strings

  const tooltipS = "Avatar (vide = automatique)";

  // state

  const [focused, setFocused] = useState(false);

  // helpers

  const avatarPlaceholder = focused
    ? ""
    : getDefaultListingAvatarString({ name });
  const fontSize = Math.round(size * 0.4);

  // handlers

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      e.target.blur();
    }
  }

  function handleFocus(e) {
    setFocused(true);
    e.target.select();
  }

  function handleBlur() {
    setFocused(false);
  }

  // render

  return (
    <Tooltip title={disabled ? "" : tooltipS}>
      <Box
        sx={[
          (theme) => ({
            width: size,
            height: size,
            borderRadius: "50%",
            flexShrink: 0,
            bgcolor: theme.palette.secondary.main,
            color: theme.palette.secondary.contrastText,
            cursor: disabled ? "default" : "text",
            transition: "box-shadow 120ms",
            "&:focus-within": {
              boxShadow: `0 0 0 2px ${alpha(theme.palette.secondary.main, 0.35)}`,
            },
          }),
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        <InputBase
          value={avatarString ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={avatarPlaceholder}
          readOnly={disabled}
          inputProps={{ maxLength: 3, "aria-label": tooltipS }}
          sx={{
            width: 1,
            height: 1,
            color: "inherit",
            fontSize,
            fontWeight: 700,
            letterSpacing: "0.02em",
            "& .MuiInputBase-input": {
              p: 0,
              height: 1,
              textAlign: "center",
              caretColor: "currentColor",
              "&::placeholder": { color: "inherit", opacity: 0.9 },
            },
          }}
        />
      </Box>
    </Tooltip>
  );
}
