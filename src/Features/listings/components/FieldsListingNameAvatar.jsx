import { Box } from "@mui/material";

import AvatarListingEditable from "./AvatarListingEditable";
import InputBaseBand from "Features/layout/components/InputBaseBand";

// ---------------------------------------------------------------------------
// FieldsListingNameAvatar — one dense row to edit a listing name + avatar:
// the avatar itself is the edit point of the avatar string (click → popover,
// empty = automatic initials), followed by the name band. Controlled;
// `onEnter` fires on Enter in the name band only. Extra children (e.g. a
// button) are rendered at the end.
// ---------------------------------------------------------------------------

export default function FieldsListingNameAvatar({
  name,
  avatarString,
  onNameChange,
  onAvatarStringChange,
  namePlaceholder,
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
      <InputBaseBand
        fullWidth
        autoFocus={autoFocus}
        placeholder={namePlaceholder}
        value={name ?? ""}
        onChange={(e) => onNameChange?.(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {children}
    </Box>
  );
}
