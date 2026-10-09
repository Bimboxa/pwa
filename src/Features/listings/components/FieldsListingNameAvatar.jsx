import { Box, TextField } from "@mui/material";

import AvatarListing from "./AvatarListing";

import { getDefaultListingAvatarString } from "../utils/getListingAvatarString";

// ---------------------------------------------------------------------------
// FieldsListingNameAvatar — one row to edit a listing name + avatar string:
// live avatar preview, "Avatar" field (max 3 chars, empty = automatic
// initials) and the name field. Controlled; `onEnter` fires on Enter in
// either field. Extra children (e.g. a button) are rendered at the end.
// ---------------------------------------------------------------------------

export default function FieldsListingNameAvatar({
  name,
  avatarString,
  onNameChange,
  onAvatarStringChange,
  nameLabel,
  namePlaceholder,
  onEnter,
  autoFocus,
  size = 40,
  children,
  sx,
}) {
  // strings

  const avatarS = "Avatar";
  const avatarHelperS = "Vide = automatique";

  // helpers

  const previewListing = { name, avatarString };
  const avatarPlaceholder = getDefaultListingAvatarString({ name });

  // handlers

  function handleKeyDown(e) {
    if (e.key === "Enter") onEnter?.();
  }

  // render

  return (
    <Box
      sx={[
        { display: "flex", gap: 1.5, alignItems: "flex-start", width: 1 },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <AvatarListing listing={previewListing} size={size} variant="selected" />
      <TextField
        size="small"
        label={avatarS}
        value={avatarString ?? ""}
        onChange={(e) => onAvatarStringChange?.(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={avatarPlaceholder}
        helperText={avatarHelperS}
        slotProps={{
          htmlInput: {
            maxLength: 3,
            style: { fontWeight: 700, textAlign: "center" },
          },
          inputLabel: { shrink: true },
        }}
        sx={{ width: 96, flexShrink: 0 }}
      />
      <TextField
        size="small"
        fullWidth
        autoFocus={autoFocus}
        label={nameLabel}
        placeholder={namePlaceholder}
        value={name ?? ""}
        onChange={(e) => onNameChange?.(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {children}
    </Box>
  );
}
