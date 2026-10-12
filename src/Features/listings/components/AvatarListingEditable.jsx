import { useState } from "react";

import { InputBase, Popover, Tooltip, Typography } from "@mui/material";

import AvatarListing from "./AvatarListing";

import { getDefaultListingAvatarString } from "../utils/getListingAvatarString";

// ---------------------------------------------------------------------------
// AvatarListingEditable — the listing avatar as the edit point of its avatar
// string: clicking the avatar opens a small popover with a 3-char field
// (empty = automatic initials derived from `name`). Fully controlled through
// `avatarString` / `onChange`; the avatar updates live while typing.
// Enter / Escape close the popover without bubbling to the parent form.
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

  const avatarS = "Avatar";
  const editAvatarS = "Modifier l'avatar";
  const avatarHintS = "Vide = automatique";

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  const previewListing = { name, avatarString };
  const avatarPlaceholder = getDefaultListingAvatarString({ name });

  // handlers

  function handleOpen(e) {
    if (disabled) return;
    setAnchorEl(e.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      handleClose();
    }
  }

  // render

  return (
    <>
      <Tooltip title={disabled ? "" : editAvatarS}>
        <span style={{ display: "inline-flex", flexShrink: 0 }}>
          <AvatarListing
            listing={previewListing}
            size={size}
            variant="selected"
            onClick={disabled ? undefined : handleOpen}
            sx={sx}
          />
        </span>
      </Tooltip>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { p: 1.5, mt: 0.5 } } }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 600, mb: 0.5, display: "block" }}
        >
          {avatarS}
        </Typography>
        <InputBase
          autoFocus
          value={avatarString ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={avatarPlaceholder}
          inputProps={{ maxLength: 3 }}
          sx={{
            width: 80,
            fontSize: "0.875rem",
            fontWeight: 700,
            px: 1,
            py: 0.5,
            borderRadius: 1,
            border: (theme) => `1px solid ${theme.palette.divider}`,
            "&:focus-within": {
              borderColor: "secondary.main",
            },
          }}
        />
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ display: "block", mt: 0.5 }}
        >
          {avatarHintS}
        </Typography>
      </Popover>
    </>
  );
}
