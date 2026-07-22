import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";

import { setPovAiEnhancePrompt } from "../povSlice";

import { Box, Button, IconButton, TextField, Typography } from "@mui/material";
import { AutoAwesome, Close } from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import useIsMobile from "Features/layout/hooks/useIsMobile";

import usePovEnhancePrompt from "../hooks/usePovEnhancePrompt";

// Editable "Amélioration IA" prompt: the instructions sent to the
// image-transformation endpoint when creating / updating a POV. The edit is
// persisted in localStorage (povSlice.aiEnhancePromptById); "Réinitialiser"
// drops it back to the org's default prompt.
export default function DialogPovEnhancePrompt({ open, onClose }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Prompt d'amélioration IA";
  const subtitleS =
    "Instructions envoyées à l'IA pour générer la vue. Modifie-les librement.";
  const cancelS = "Annuler";
  const saveS = "Enregistrer";
  const resetS = "Réinitialiser";

  // data

  const { prompt, promptText, defaultPromptText, isCustom } =
    usePovEnhancePrompt();

  const isMobile = useIsMobile();

  // state

  const [value, setValue] = useState(promptText);

  // effect - reload the stored text each time the dialog opens

  useEffect(() => {
    if (open) setValue(promptText);
  }, [open, promptText]);

  // handlers

  function handleSave() {
    const text = value?.trim() ?? "";
    dispatch(
      setPovAiEnhancePrompt({
        promptId: prompt?.id,
        // Back to the default text = no override.
        prompt: text && text !== defaultPromptText.trim() ? value : null,
      })
    );
    onClose();
  }

  function handleReset() {
    setValue(defaultPromptText);
  }

  // render

  return (
    <DialogGeneric
      open={open}
      onClose={onClose}
      width={560}
      title={isMobile ? titleS : undefined}
    >
      <Box sx={{ p: 3, pt: 2.5 }}>
        {/* on mobile the title & close live in DialogGeneric's header */}
        {!isMobile && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <AutoAwesome fontSize="small" color="secondary" />
            <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
              {titleS}
            </Typography>
            <IconButton size="small" onClick={onClose}>
              <Close fontSize="small" />
            </IconButton>
          </Box>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {subtitleS}
        </Typography>

        <TextField
          fullWidth
          multiline
          minRows={8}
          maxRows={16}
          size="small"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          sx={{
            mt: 2,
            "& textarea": { fontFamily: "monospace", fontSize: 13 },
          }}
        />

        <Box
          sx={{
            mt: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 1,
          }}
        >
          {(isCustom || value !== defaultPromptText) && (
            <Button
              size="small"
              color="inherit"
              onClick={handleReset}
              sx={{ textTransform: "none", mr: "auto" }}
            >
              {resetS}
            </Button>
          )}
          <Button
            variant="outlined"
            color="inherit"
            onClick={onClose}
            sx={{ textTransform: "none" }}
          >
            {cancelS}
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleSave}
            sx={{ textTransform: "none" }}
          >
            {saveS}
          </Button>
        </Box>
      </Box>
    </DialogGeneric>
  );
}
