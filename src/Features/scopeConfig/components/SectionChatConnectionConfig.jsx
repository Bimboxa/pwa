import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import {
  Alert,
  Box,
  Button,
  Divider,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import useScopeConfigActions from "../hooks/useScopeConfigActions";
import {
  selectRelayConnectionMode,
  selectRelayBaseUrl,
  selectSavedChatConnection,
  normalizeRelayBaseUrl,
} from "Features/assistantRelay/utils/relayConnection.js";

export default function SectionChatConnectionConfig() {
  const mode = useSelector(selectRelayConnectionMode);
  const baseUrl = useSelector(selectRelayBaseUrl);
  const saved = useSelector(selectSavedChatConnection);
  const { scopeId, setChatConnection } = useScopeConfigActions();
  const [draftMode, setDraftMode] = useState(mode);
  const [draftUrl, setDraftUrl] = useState(baseUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setDraftMode(mode);
    setDraftUrl(baseUrl);
    setError(null);
  }, [mode, baseUrl, scopeId]);

  async function save(reset = false) {
    setError(null);
    try {
      if (!reset && !["jwt", "PWA_KEY"].includes(draftMode))
        throw new Error("Choisissez un mode de connexion.");
      const connection = reset
        ? null
        : { mode: draftMode, baseUrl: normalizeRelayBaseUrl(draftUrl) };
      setSaving(true);
      if (!(await setChatConnection(connection)))
        throw new Error(
          "Sélectionnez un périmètre pour enregistrer ces réglages."
        );
    } catch (e) {
      setError(e.message || "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
        Connexion au serveur Chat
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <TextField
          select
          fullWidth
          size="small"
          label="Mode de connexion"
          value={draftMode}
          disabled={saving || !scopeId}
          onChange={(e) => setDraftMode(e.target.value)}
        >
          <MenuItem value="jwt">JWT — session utilisateur</MenuItem>
          <MenuItem value="PWA_KEY">PWA_KEY — clé du serveur</MenuItem>
        </TextField>
        <TextField
          fullWidth
          size="small"
          label="URL du serveur Chat"
          value={draftUrl}
          placeholder="https://serveur.example.com"
          disabled={saving || !scopeId}
          onChange={(e) => setDraftUrl(e.target.value)}
          helperText="Adresse de base du serveur, sans ajouter /bridge ou /chat/turns."
        />
        <Typography variant="caption" color="text.secondary">
          {draftMode === "jwt"
            ? "Le Chat utilise automatiquement votre session utilisateur."
            : "La clé du serveur se renseigne dans le Chat et reste dans cet onglet."}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {saved
            ? "Réglages enregistrés pour ce périmètre."
            : "Valeurs par défaut de l’organisation."}
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button
            size="small"
            disabled={saving || !scopeId || !saved}
            onClick={() => save(true)}
          >
            Rétablir les valeurs par défaut
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={saving || !scopeId || !draftUrl.trim()}
            onClick={() => save()}
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </Box>
      </Box>
    </>
  );
}
