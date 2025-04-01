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

import FieldText from "./FieldText";

export default function FieldTextVariantGrid({
  value,
  onChange,
  options,
  label,
  size = 8,
}) {
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
    <Grid2
      container
      sx={{border: (theme) => `1px solid ${theme.palette.divider}`}}
    >
      <Grid2 size={12 - size} sx={{p: 1, bgcolor: "background.default"}}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Grid2>
      <Grid2 size={size}>
        <FieldText
          value={value}
          onChange={onChange}
          options={{fullWidth: true, ...options}}
          label={label}
        />
      </Grid2>
    </Grid2>
  );
}
