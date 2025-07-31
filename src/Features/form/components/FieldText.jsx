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

export default function FieldText({ value, onChange, options, label }) {
  const fullWidth = options?.fullWidth;
  const multiline = options?.multiline;
  const showLabel = options?.showLabel;
  const hideMic = options?.hideMic;
  const autoFocus = options?.autoFocus;
  const hideBorder = options?.hideBorder;

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
    const newValue = event.target.value;
    setTempValue(newValue);
  }

  function handleOnBlur() {
    console.log("handleOnBlur", tempValue);

    const newValue = tempValue.toString().trim();
    onChange(newValue);
  }

  return (
    <TextField
      size="small"
      autoFocus={autoFocus}
      label={showLabel ? label : null}
      fullWidth={fullWidth}
      multiline={multiline}
      value={tempValue}
      onChange={handleChange}
      onBlur={handleOnBlur}
      onKeyDown={(e) => e.stopPropagation()}
      slotProps={{
        input: {
          endAdornment: tempValue ? (
            <InputAdornment position="end">
              <IconButton
                onClick={() => setTempValue("")}
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
      }}
    />
  );
}
