import { useEffect, useRef, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { alpha } from "@mui/material/styles";
import { Box, Button, TextField, Typography } from "@mui/material";

import { closeChronoCreate, startChronoStep } from "../chronoSlice";

export default function OverlayNewChronoStep() {
  const dispatch = useDispatch();

  // data

  const open = useSelector((s) => s.chrono.creating);
  const hasActiveStep = useSelector((s) => Boolean(s.chrono.activeStep));

  // state

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const inputRef = useRef(null);

  // effects

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      // focus next tick so the field is mounted
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // handlers

  function handleStart() {
    dispatch(startChronoStep({ name, description }));
  }

  function handleCancel() {
    dispatch(closeChronoCreate());
  }

  function handleNameKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleStart();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  }

  function handleDescriptionKeyDown(e) {
    // Cmd/Ctrl+Enter submits from the description field; plain Enter inserts a newline.
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleStart();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  }

  // render

  if (!open) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        bgcolor: "rgba(15, 15, 20, 0.85)",
        zIndex: 1500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
      onClick={handleCancel}
    >
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          width: "100%",
          maxWidth: 420,
          bgcolor: "white",
          borderRadius: 2,
          boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
          borderTop: (theme) => `4px solid ${theme.palette.secondary.main}`,
          p: 3,
        }}
      >
        <Typography
          variant="overline"
          sx={{
            color: "secondary.main",
            fontWeight: 700,
            letterSpacing: "0.14em",
            display: "block",
            mb: 1.5,
          }}
        >
          {hasActiveStep ? "Nouvelle étape" : "Nouvelle tâche"}
        </Typography>

        <TextField
          inputRef={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleNameKeyDown}
          placeholder="Ex: création d'un fond de plan"
          fullWidth
          autoFocus
          size="small"
        />

        <Box
          sx={{
            mt: 1.5,
            bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.06),
            borderRadius: 1,
            px: 1.25,
            py: 1,
          }}
        >
          <TextField
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={handleDescriptionKeyDown}
            placeholder="Commentaires"
            fullWidth
            multiline
            minRows={3}
            variant="standard"
            slotProps={{
              input: { disableUnderline: true },
            }}
            sx={{
              "& .MuiInputBase-input": {
                fontSize: "0.875rem",
                lineHeight: 1.5,
              },
            }}
          />
        </Box>

        <Box
          sx={{
            mt: 3,
            display: "flex",
            justifyContent: "flex-end",
            gap: 1,
          }}
        >
          <Button onClick={handleCancel} color="inherit">
            Annuler
          </Button>
          <Button
            onClick={handleStart}
            variant="contained"
            color="secondary"
          >
            Démarrer
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
