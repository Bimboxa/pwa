import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

export default function ChatAutoButton({
  send,
  disabled,
  hasVisibleTemplates,
}) {
  const [open, setOpen] = useState(false);
  const [currentListing, setCurrentListing] = useState(true);
  const [autonomous, setAutonomous] = useState(false);
  const [description, setDescription] = useState("");
  const valid =
    (currentListing || autonomous) &&
    (!currentListing || hasVisibleTemplates) &&
    (!autonomous || Boolean(description.trim()));

  function launch() {
    if (disabled || !valid) return;
    const options = {
      currentListing,
      autonomous,
      description: autonomous ? description.trim() : "",
    };
    const message = [
      currentListing
        ? "Repère les annotations des modèles visibles de la liste courante, en utilisant leurs descriptions et les exemples déjà dessinés, sans doublons."
        : "",
      autonomous
        ? `Détection autonome : ${options.description}. Définis les modèles nécessaires et crée-les dans la liste courante.`
        : "",
      currentListing && autonomous
        ? "Commence par les modèles existants, puis complète si nécessaire avec de nouveaux modèles dans le groupe IA."
        : "",
    ]
      .filter(Boolean)
      .join("\n");
    setOpen(false);
    send(message, { autoDetect: options });
  }

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        color="inherit"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Auto
      </Button>
      {open && (
        <Box
          role="region"
          aria-label="Détection automatique"
          onDrop={(e) => e.stopPropagation()}
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 5,
            bgcolor: "background.default",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <Box
            sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
          >
            <Button size="small" color="inherit" onClick={() => setOpen(false)}>
              Retour à la discussion
            </Button>
            <Typography variant="h6" sx={{ mt: 1 }}>
              Détection automatique
            </Typography>
          </Box>
          <Stack spacing={2} sx={{ p: 2, flex: 1, overflowY: "auto" }}>
            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={currentListing}
                    onChange={(e) => setCurrentListing(e.target.checked)}
                  />
                }
                label="Détection auto à partir de la liste en cours"
              />
              <Typography variant="body2" color="text.secondary">
                Repérer les modèles visibles de la liste courante, avec leurs
                descriptions et les annotations déjà dessinées comme exemples.
              </Typography>
            </Box>
            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={autonomous}
                    onChange={(e) => setAutonomous(e.target.checked)}
                  />
                }
                label="Détection autonome"
              />
              <Typography variant="body2" color="text.secondary">
                L’IA choisit les types d’annotations et définit les nouveaux
                modèles à partir de votre description. Ils seront créés dans la
                liste courante.
              </Typography>
            </Box>
            {autonomous && (
              <TextField
                label="Que faut-il repérer ?"
                multiline
                minRows={4}
                fullWidth
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                inputProps={{ maxLength: 4000 }}
                placeholder="Exemple : repérer les portes, les fenêtres et les poteaux…"
              />
            )}
            {currentListing && autonomous && (
              <Alert severity="info">
                L’IA commence par les modèles de la liste, puis peut en créer de
                nouveaux dans le groupe « IA ».
              </Alert>
            )}
            {currentListing && !hasVisibleTemplates && (
              <Alert severity="warning">
                Cette liste ne contient aucun modèle visible. Choisissez la
                détection autonome seule ou ajoutez des modèles.
              </Alert>
            )}
            <Typography variant="caption" color="text.secondary">
              Le plan sera envoyé pour cette détection, même si « Ne pas envoyer
              le plan » est coché. Le PDF source est utilisé en priorité, sinon
              l’image du fond.
            </Typography>
          </Stack>
          <Box
            sx={{
              p: 1.5,
              display: "flex",
              justifyContent: "flex-end",
              borderTop: "1px solid",
              borderColor: "divider",
            }}
          >
            <Button
              variant="contained"
              disabled={disabled || !valid}
              onClick={launch}
            >
              Lancer la détection
            </Button>
          </Box>
        </Box>
      )}
    </>
  );
}
