import {useEffect, useRef, useState} from "react";
import {
  Autocomplete,
  TextField,
  Box,
  Grid2,
  Typography,
  IconButton,
  InputAdornment,
} from "@mui/material";

import {Stop, Mic as MicIcon} from "@mui/icons-material";
import useRecognition from "../hooks/useRecognition";

export default function FieldText({value, onChange, options, label}) {
  const fullWidth = options?.fullWidth;
  const multiline = options?.multiline;
  const showLabel = options?.showLabel;

  const [recording, setRecording] = useState(false);

  const [tempValue, setTempValue] = useState(value ?? "");
  useEffect(() => {
    setTempValue(value ?? "");
  }, [value]);

  const {recognitionRef, recordingRef} = useRecognition(
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
    const newValue = tempValue.trim();
    onChange(newValue);
  }

  return (
    <TextField
      size="small"
      label={showLabel ? label : null}
      fullWidth={fullWidth}
      multiline={multiline}
      value={tempValue}
      onChange={handleChange}
      onBlur={handleOnBlur}
      onKeyDown={(e) => e.stopPropagation()}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={handleMicClick} size="small">
                {recording ? <Stop sx={{color: "red"}} /> : <MicIcon />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
