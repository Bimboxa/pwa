import { useState, useEffect, useRef, useCallback } from "react";

import { TextField } from "@mui/material";

const DEBOUNCE_MS = 400;

export default function DebouncedTextField({
  value: externalValue,
  onChange,
  delay = DEBOUNCE_MS,
  ...props
}) {
  const [localValue, setLocalValue] = useState(externalValue ?? "");
  const timerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // sync from external when not actively editing
  useEffect(() => {
    setLocalValue(externalValue ?? "");
  }, [externalValue]);

  const handleChange = useCallback(
    (e) => {
      const val = e.target.value;
      setLocalValue(val);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onChangeRef.current?.(val);
      }, delay);
    },
    [delay]
  );

  // flush on unmount
  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <TextField {...props} value={localValue} onChange={handleChange} />
  );
}
