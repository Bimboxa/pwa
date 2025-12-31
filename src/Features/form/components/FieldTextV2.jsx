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
  const fullWidth = options?.fullWidth; // to consider default value from entities model
  const multiline = options?.multiline;
  const showLabel = options ? options?.showLabel : true;
  const hideMic = options?.hideMic;
  const autoFocus = options?.autoFocus;
  const hideBorder = options?.hideBorder;
  const placeholder = options?.placeholder;
  const showAsSection = options?.showAsSection;
  const showAsField = options?.showAsField;
  const hideTopDivider = options?.hideTopDivider;
  const showAsLabelAndField = options?.showAsLabelAndField;
  const readOnly = options?.readOnly;
  const showClose = options?.showClose;
  const isNumber = options?.isNumber;
  const changeOnBlur = options?.changeOnBlur;

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
    event.stopPropagation();
    if (readOnly) return;
    let newValue = event.target.value;
    setTempValue(newValue);

    if (!changeOnBlur) onChange(newValue.trim());
  }

  function handleOnBlur() {
    console.log("handleOnBlur", tempValue);

    let newValue = tempValue.toString().trim();

    if (isNumber) {
      newValue.replace(",", ".");
      newValue = Number(newValue);
      if (isNaN(newValue)) newValue = 0;
    }
    onChange(newValue);
  }

  // render

  const textField = <TextField
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
          tempValue && !readOnly && showClose ? (
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

  if (showAsLabelAndField) {
    return <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: "bold" }}>
        {label}
      </Typography>
      {textField}
    </Box>
  }

  if (showAsField) {
    return <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, width: 1, justifyContent: "space-between" }}>
      <Typography variant="body2" sx={{ fontWeight: "bold" }} noWrap>
        {label}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {textField}
      </Box>
    </Box>
  }

  return (
    <Box
      sx={{
        // p: 1,
        width: 1,
        ...(showAsSection && !hideTopDivider && {
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          p: 1,
        }),
      }}
    >
      {showAsSection && (
        <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
          {label}
        </Typography>
      )}
      <Box
        sx={{
          width: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: showAsField ? "space-between" : null,
        }}
      >
        {showAsField && (
          <Typography
            variant="body2"
            //color="text.secondary"
            sx={{ fontWeight: "bold", mr: 1, flexGrow: 1, minWidth: 0 }}
          >
            {label}
          </Typography>
        )}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            ...showLabel && { p: 1 }
          }}
        >
          {textField}
        </Box>
      </Box>
    </Box>
  );
}
