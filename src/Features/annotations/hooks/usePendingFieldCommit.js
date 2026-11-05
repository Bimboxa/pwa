import { useEffect, useRef } from "react";

// Commits the pending entry, if any. Returns true when a write was sent.
function commitPending(pendingRef) {
  const pending = pendingRef.current;
  if (!pending) return false;
  pendingRef.current = null;

  const { target, value, onChange, field, allowNull } = pending;
  const text = String(value ?? "")
    .replace(",", ".")
    .trim();

  let next;
  if (text === "") {
    if (!allowNull) return false;
    next = null;
  } else {
    next = parseFloat(text);
    if (!Number.isFinite(next)) return false;
  }

  // Typed back to the stored value: no write, no undo entry.
  if (next === (target?.[field] ?? null)) return false;

  onChange?.({ ...target, [field]: next });
  return true;
}

// "Commit on blur" buffer for a numeric field: the typed text stays local
// until the field is left (blur / Enter), then one single write is sent.
//
// The pending entry captures the edited record AND its change handler at
// typing time, so a late commit (selection already moved on, toolbar already
// closed) still lands on the record the user was editing.
//
// - field     : key written on the record
// - targetId  : id of the edited record; a change flushes the pending entry
// - allowNull : an emptied field commits `null` (otherwise it is dropped)
export default function usePendingFieldCommit({
  field,
  targetId,
  allowNull = true,
}) {
  const pendingRef = useRef(null);

  // Safety net: a focused input removed from the DOM gets no reliable blur
  // (toolbar closed by a deselection), and the selection can change while the
  // toolbar stays mounted.
  useEffect(() => {
    return () => {
      commitPending(pendingRef);
    };
  }, [targetId]);

  function setPending({ target, value, onChange }) {
    pendingRef.current = { target, value, onChange, field, allowNull };
  }

  function flush() {
    return commitPending(pendingRef);
  }

  function discard() {
    pendingRef.current = null;
  }

  return { setPending, flush, discard };
}
