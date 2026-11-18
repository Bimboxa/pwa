import { useRef, useState } from "react";

import { InputBase } from "@mui/material";

// Number input that keeps the typed text local and hands it to `onCommit`
// (raw string) only on blur or Enter, so the field can be cleared and retyped
// without every keystroke being written. While not being edited it shows
// `value`, so external changes (drag on the plan, reset…) are reflected.
export default function InputNumberOnBlur({
  value,
  onCommit,
  inputProps,
  endAdornment,
  sx,
}) {
  // state

  // null = not being edited.
  const [draft, setDraft] = useState(null);
  // Set by Escape: the next blur drops the draft instead of committing it.
  const cancelRef = useRef(false);

  // handlers

  function handleChange(e) {
    setDraft(e.target.value);
  }

  function handleBlur() {
    const cancelled = cancelRef.current;
    cancelRef.current = false;
    if (draft === null) return;
    if (!cancelled && draft !== String(value)) onCommit(draft);
    setDraft(null);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") e.target.blur();
    if (e.key === "Escape") {
      // blur() runs handleBlur synchronously, with the draft still set.
      cancelRef.current = true;
      e.target.blur();
    }
  }

  // render

  return (
    <InputBase
      type="number"
      value={draft ?? value}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      inputProps={inputProps}
      endAdornment={endAdornment}
      sx={sx}
    />
  );
}
