import { useEffect, useState } from "react";

import { InputBase } from "@mui/material";

// Compact numeric InputBase (52px wide, used inside the style popovers) that
// keeps a local draft while typing and only commits on blur / Enter.
//
//   value          — number | null, the committed value from the parent
//   onCommit(raw)  — called on blur with the cleaned draft string ("" allowed)
//                    when it differs from the committed value. Return false
//                    to reject the draft: the field reverts to `value`.
//   placeholder    — shown when the draft is empty
//
// Enter commits (blurs), Escape reverts the draft and lets the key bubble so
// an enclosing Popover closes; every other key stops propagating so the map
// editor hotkeys do not fire while typing.
export default function InputNumberCompact({
  value,
  onCommit,
  placeholder,
  sx,
}) {
  // state

  const committed = String(value ?? "");
  const [draft, setDraft] = useState(committed);

  useEffect(() => {
    setDraft(committed);
  }, [committed]);

  // handlers

  function handleChange(e) {
    const cleaned = String(e.target.value)
      .replace(",", ".")
      .replace(/[^0-9.]/g, "");
    setDraft(cleaned);
  }

  function handleBlur() {
    if (draft === committed) return;
    const accepted = onCommit?.(draft);
    if (accepted === false) setDraft(committed);
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      setDraft(committed);
      return;
    }
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
    }
  }

  // render

  return (
    <InputBase
      value={draft}
      placeholder={placeholder === undefined ? undefined : String(placeholder)}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      sx={{
        width: 52,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        px: 1,
        height: 28,
        fontSize: "0.8rem",
        "& input": { textAlign: "center", p: 0 },
        ...sx,
      }}
    />
  );
}
