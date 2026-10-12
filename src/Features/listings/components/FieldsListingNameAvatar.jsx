import { Box, TextField } from "@mui/material";

import AvatarListingEditable from "./AvatarListingEditable";
import InputBaseBand from "Features/layout/components/InputBaseBand";

// ---------------------------------------------------------------------------
// FieldsListingNameAvatar — one row to edit a listing name + avatar: the
// avatar itself is the edit point of the avatar string (letters typed in
// place, empty = automatic initials), followed by the name. `nameVariant`:
// "band" (dense InputBaseBand, default) or "field" (outlined TextField).
// Controlled; `onEnter` fires on Enter in the name only. Extra children
// (e.g. a button) are rendered at the end.
// ---------------------------------------------------------------------------

export default function FieldsListingNameAvatar({
  name,
  avatarString,
  onNameChange,
  onAvatarStringChange,
  namePlaceholder,
  nameVariant = "band",
  onEnter,
  autoFocus,
  size = 32,
  children,
  sx,
}) {
  // handlers

  function handleKeyDown(e) {
    if (e.key === "Enter") onEnter?.();
  }

  // render

  const nameProps = {
    fullWidth: true,
    autoFocus,
    placeholder: namePlaceholder,
    value: name ?? "",
    onChange: (e) => onNameChange?.(e.target.value),
    onKeyDown: handleKeyDown,
  };

  return (
    <Box
      sx={[
        { display: "flex", gap: 1, alignItems: "center", width: 1 },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <AvatarListingEditable
        name={name}
        avatarString={avatarString}
        onChange={onAvatarStringChange}
        size={size}
      />
      {nameVariant === "field" ? (
        <TextField size="small" {...nameProps} />
      ) : (
        <InputBaseBand {...nameProps} />
      )}
      {children}
    </Box>
  );
}
