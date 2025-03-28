import {useEffect, useRef} from "react";
import {
  Autocomplete,
  TextField,
  Box,
  Grid2,
  Typography,
  IconButton,
  InputAdornment,
} from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";

export default function FieldText({value, onChange, options, label}) {
  const fullWidth = options?.fullWidth;
  const multiline = options?.multiline;

  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition non supportée par ce navigateur.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onChange(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Erreur de reconnaissance vocale :", event.error);
    };

    recognitionRef.current = recognition;
  }, [onChange]);

  const handleMicClick = () => {
    recognitionRef.current?.start();
  };

  function handleChange(event) {
    const newValue = event.target.value;
    onChange(newValue);
  }

  return (
    <TextField
      label={label}
      fullWidth={fullWidth}
      multiline={multiline}
      value={value ?? ""}
      onChange={handleChange}
      onKeyDown={(e) => e.stopPropagation()}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={handleMicClick}>
                <MicIcon />
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
