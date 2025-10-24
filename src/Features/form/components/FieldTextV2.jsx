import { useEffect, useRef, useState } from "react";
import {
  Autocomplete,
  TextField,
  Box,
  Grid,
  Typography,
  IconButton,
  InputAdornment,
} from "@mui/material";

import { Stop, Mic as MicIcon, Close } from "@mui/icons-material";
import useRecognition from "../hooks/useRecognition";

export default function FieldTextV2({ value, onChange, options, label }) {
  const fullWidth = options ? options?.fullWidth : true; // to consider default value from entities model
  const multiline = options?.multiline;
  const showLabel = options ? options?.showLabel : true;
  const hideMic = options?.hideMic;
  const autoFocus = options?.autoFocus;
  const hideBorder = options?.hideBorder;
  const placeholder = options?.placeholder;
  const showAsSection = options?.showAsSection;
  const readOnly = options?.readOnly;

  const [recording, setRecording] = useState(false);

  const [tempValue, setTempValue] = useState(value ?? "");

  useEffect(() => {
    setTempValue(value ?? "");
  }, [value]);

  const { recognitionRef, recordingRef } = useRecognition(
    handleRecognitionChange
  );

  function handleRecognitionChange(newValue) {
    setTempValue(newValue);
  }

  const handleMicClick = () => {
    console.log("Was recording", recordingRef.current);
    if (recordingRef.current) {
      setRecording(false);
      recognitionRef.current.stop();
      onChange(tempValue);
    } else {
      setRecording(true);
      recognitionRef.current.start();
    }
  };

  function handleChange(event) {
    if (readOnly) return;
    const newValue = event.target.value;
    setTempValue(newValue);
  }

  function handleOnBlur() {
    console.log("handleOnBlur", tempValue);

    const newValue = tempValue.toString().trim();
    onChange(newValue);
  }

  return (
    <Box
      sx={{
        p: 1,
        width: 1,
        ...(showAsSection && {
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        }),
      }}
    >
      {showAsSection && (
        <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
          {label}
        </Typography>
      )}
      <TextField
        size="small"
        readOnly={readOnly}
        autoFocus={autoFocus}
        label={showLabel ? label : null}
        placeholder={placeholder}
        fullWidth={fullWidth}
        multiline={multiline}
        value={tempValue}
        onChange={handleChange}
        onBlur={handleOnBlur}
        onKeyDown={(e) => e.stopPropagation()}
        slotProps={{
          input: {
            endAdornment:
              tempValue && !readOnly ? (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => onChange("")}
                    //edge="start"
                    size="small"
                  >
                    <Close fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            // endAdornment: !hideMic ? (
            //   <InputAdornment position="end">
            //     <IconButton onClick={handleMicClick} size="small">
            //       {recording ? <Stop sx={{color: "red"}} /> : <MicIcon />}
            //     </IconButton>
            //   </InputAdornment>
            // ) : null,
          },
        }}
        sx={{
          "& .MuiOutlinedInput-root": hideBorder
            ? {
                "& fieldset": {
                  border: "none",
                },
              }
            : {},
          "& .MuiInputBase-input": {
            fontSize: (theme) => theme.typography.body2.fontSize,
          },
        }}
      />
    </Box>
  );
}
