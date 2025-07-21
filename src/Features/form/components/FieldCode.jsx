import { useState, useRef, useEffect } from "react";
import { Box, TextField, Button, Typography } from "@mui/material";

export default function FieldCode({
  value = "",
  onChange,
  digitsLength,
  locked,
  onLockedChange,
  ...props
}) {
  // strings

  const resetS = "Reset";

  // refs for each input
  const inputsRef = useRef([]);

  // state for each digit
  const [digitByIndex, setDigitByIndex] = useState(() => {
    const initial = {};
    for (let i = 0; i < digitsLength; i++) {
      initial[i] = value[i] || "";
    }
    return initial;
  });
  const [focusedIndex, setFocusedIndex] = useState(0);

  // keep digitByIndex in sync with value prop
  useEffect(() => {
    setDigitByIndex((prev) => {
      const updated = { ...prev };
      for (let i = 0; i < digitsLength; i++) {
        updated[i] = value[i] || "";
      }
      return updated;
    });
  }, [value, digitsLength]);

  useEffect(() => {
    // On mount, focus the first input and set caret position
    if (inputsRef.current[0]) {
      inputsRef.current[0].focus();
      setTimeout(() => {
        const input = inputsRef.current[0];
        if (input) {
          input.setSelectionRange(0, input.value.length);
        }
      }, 0);
    }
  }, []);

  // helpers
  const indexes = Array.from({ length: digitsLength }, (_, i) => i);

  // handlers
  const handleChange = (e, index) => {
    const newValue = e.target.value.replace(/\D/g, ""); // only digits
    if (!newValue) return;
    setDigitByIndex((dbi) => {
      const updated = { ...dbi, [index]: newValue[0] };
      const code = indexes.map((i) => updated[i] || "").join("");

      // Only propagate up if code is complete
      if (code.length === digitsLength) {
        onChange && onChange(code);
      }
      return updated;
    });
    // move focus to next
    if (index < digitsLength - 1) {
      const nextInput = inputsRef.current[index + 1];
      if (nextInput) {
        nextInput.focus();
        setTimeout(() => {
          nextInput.setSelectionRange(1, 1);
        }, 0);
      }
      setFocusedIndex(index + 1);
    }
  };

  const handleFocus = (index) => {
    setFocusedIndex(index);
    // select content for easy overwrite
    const input = inputsRef.current[index];
    if (input) {
      setTimeout(() => {
        input.setSelectionRange(0, input.value.length);
      }, 0);
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      if (digitByIndex[index]) {
        setDigitByIndex((dbi) => {
          const updated = { ...dbi, [index]: "" };
          const code = indexes.map((i) => updated[i] || "").join("");
          // Only propagate up if code is complete
          if (code.length === digitsLength && !code.includes("")) {
            onChange && onChange(code);
          }
          return updated;
        });
      } else if (index > 0) {
        const prevInput = inputsRef.current[index - 1];
        if (prevInput) {
          prevInput.focus();
          setTimeout(() => {
            prevInput.setSelectionRange(1, 1);
          }, 0);
        }
        setFocusedIndex(index - 1);
      }
    }
  };

  const handleReset = () => {
    // Clear all digits
    setDigitByIndex(() => {
      const cleared = {};
      for (let i = 0; i < digitsLength; i++) {
        cleared[i] = "";
      }
      return cleared;
    });

    // Reset focus to first input
    setFocusedIndex(0);
    const firstInput = inputsRef.current[0];
    if (firstInput) {
      firstInput.focus();
    }

    // Unlock
    onLockedChange(false);
  };

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          "&>*:not(last-child)": { mr: 1 },
        }}
      >
        {indexes.map((index) => {
          const focused = focusedIndex === index;
          const val = digitByIndex[index];
          return (
            <Box key={index}>
              <TextField
                disabled={locked}
                color="secondary"
                inputRef={(el) => (inputsRef.current[index] = el)}
                focused={focused}
                onFocus={() => handleFocus(index)}
                value={val ?? ""}
                onChange={(e) => handleChange(e, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                sx={{ width: 40 }}
                slotProps={{
                  input: {
                    maxLength: 1,
                    style: { textAlign: "center" },
                    inputMode: "numeric",
                    pattern: "[0-9]*",
                    autoComplete: "one-time-code",
                  },
                }}
              />
            </Box>
          );
        })}
      </Box>
      <Box sx={{ width: 1, mt: 2, display: "flex", justifyContent: "end" }}>
        <Button onClick={handleReset}>
          <Typography variant="body2" color="text.secondary">
            {resetS}
          </Typography>
        </Button>
      </Box>
    </Box>
  );
}
