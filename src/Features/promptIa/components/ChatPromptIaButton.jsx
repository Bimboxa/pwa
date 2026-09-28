import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import { getVisibleListingTemplates } from "Features/chat/utils/buildAutoDetectionContext";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import useApplyPromptIaOutput from "../hooks/useApplyPromptIaOutput";
import buildPromptIaZip from "../services/buildPromptIaZip";
import { extractJsonText } from "../utils/parsePromptIaOutput";

const APPLY_DEBOUNCE_MS = 300;

function formatBytes(n) {
  if (!(n > 0)) return "";
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

function plural(n, one, many) {
  return `${n} ${n > 1 ? many : one}`;
}

/**
 * « Prompt IA »: prepares a self-contained zip (instructions + plan) for an
 * external AI chat, and applies the JSON the chat gives back. No relay.
 */
export default function ChatPromptIaButton({ disabled }) {
  const baseMap = useMainBaseMap();
  const templates = useAnnotationTemplates();
  const { value: listing } = useSelectedListing();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const listingId = listing?.id ?? null;
  const annotations = useAnnotationsV2({
    caller: "ChatPromptIaButton",
    enabled: Boolean(baseMap?.id && listingId),
    filterByMainBaseMap: true,
    filterBySelectedListing: true,
    filterBySelectedScope: true,
  });
  const hasVisibleTemplates =
    getVisibleListingTemplates(templates, listingId).length > 0;
  const calibrated = (baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx) > 0;

  const [open, setOpen] = useState(false);
  const [fromTemplates, setFromTemplates] = useState(true);
  const [free, setFree] = useState(false);
  const [description, setDescription] = useState("");
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState(null);
  const [built, setBuilt] = useState(null);
  const [pasted, setPasted] = useState("");
  const [dropWarning, setDropWarning] = useState(null);
  const appliedTextRef = useRef("");
  const timerRef = useRef(null);

  const { apply, undo, busy, error, lastResult, clearError } =
    useApplyPromptIaOutput();

  // Default the templates box to what the list offers, once known.
  useEffect(() => {
    if (!open) return;
    if (!hasVisibleTemplates && fromTemplates && !free) {
      setFromTemplates(false);
      setFree(true);
    }
  }, [open]);

  const valid =
    (fromTemplates || free) &&
    (!fromTemplates || hasVisibleTemplates) &&
    (!free || Boolean(description.trim()));
  const canDownload =
    valid && calibrated && Boolean(baseMap?.id && listingId) && !building;

  async function download() {
    if (!canDownload) return;
    setBuilding(true);
    setBuildError(null);
    try {
      const result = await buildPromptIaZip({
        baseMap,
        projectId,
        listing: { id: listingId, name: listing?.name },
        templates,
        annotations,
        mode: { fromTemplates, free, description: description.trim() },
      });
      setBuilt(result);
    } catch (err) {
      console.error("[promptIa] zip failed", err);
      setBuildError(err?.message ?? String(err));
    } finally {
      setBuilding(false);
    }
  }

  async function applyText(text) {
    if (!text?.trim() || text === appliedTextRef.current) return;
    // Only complete JSON triggers the import: partial input just waits.
    if (!extractJsonText(text).ok) return;
    appliedTextRef.current = text;
    const outcome = await apply(text);
    if (outcome.ok) {
      setPasted("");
      setDropWarning(
        outcome.result.droppedIds.length
          ? `${plural(outcome.result.droppedIds.length, "annotation écartée", "annotations écartées")} (hors du cadre du fond).`
          : null
      );
    } else {
      appliedTextRef.current = "";
    }
  }

  function handleChange(e) {
    const text = e.target.value;
    setPasted(text);
    if (error) clearError();
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => applyText(text), APPLY_DEBOUNCE_MS);
  }

  function handlePaste(e) {
    const text = e.clipboardData?.getData("text");
    if (!text) return;
    e.preventDefault();
    setPasted(text);
    if (error) clearError();
    clearTimeout(timerRef.current);
    applyText(text);
  }

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const created = lastResult
    ? `${plural(lastResult.placedIds.length, "annotation", "annotations")} et ${plural(
        lastResult.createdTemplateIds.length + lastResult.reusedTemplateIds.length,
        "modèle",
        "modèles"
      )}${
        lastResult.reusedTemplateIds.length
          ? ` (${lastResult.reusedTemplateIds.length} existant${lastResult.reusedTemplateIds.length > 1 ? "s" : ""})`
          : ""
      } dans « ${listing?.name ?? "la liste courante"} »`
    : null;

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        color="inherit"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Prompt IA
      </Button>
      {open && (
        <Box
          role="region"
          aria-label="Prompt IA"
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
              Prompt IA
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Faites détecter les annotations par l’outil de chat IA de votre
              choix (ChatGPT, Claude…), sans connexion au relais.
            </Typography>
          </Box>
          <Stack spacing={2} sx={{ p: 2, flex: 1, overflowY: "auto" }}>
            <Typography variant="subtitle2">1. Que détecter ?</Typography>
            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={fromTemplates}
                    onChange={(e) => setFromTemplates(e.target.checked)}
                  />
                }
                label="Détection à partir des modèles de la liste"
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
                    checked={free}
                    onChange={(e) => setFree(e.target.checked)}
                  />
                }
                label="Détection libre"
              />
              <Typography variant="body2" color="text.secondary">
                L’IA choisit les types d’annotations et définit les nouveaux
                modèles à partir de votre description. Ils seront créés dans la
                liste courante.
              </Typography>
            </Box>
            {free && (
              <TextField
                label="Que faut-il repérer ?"
                multiline
                minRows={3}
                fullWidth
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                inputProps={{ maxLength: 4000 }}
                placeholder="Exemple : repérer les portes, les fenêtres et les poteaux…"
              />
            )}
            {fromTemplates && !hasVisibleTemplates && (
              <Alert severity="warning">
                Cette liste ne contient aucun modèle visible. Choisissez la
                détection libre seule ou ajoutez des modèles.
              </Alert>
            )}
            {!calibrated && (
              <Alert severity="warning">
                Ce fond de plan n’est pas calibré (échelle inconnue). Calibrez-le
                avant de préparer le zip : les épaisseurs en centimètres en
                dépendent.
              </Alert>
            )}

            <Typography variant="subtitle2" sx={{ pt: 1 }}>
              2. Préparer le zip
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button
                variant="contained"
                disabled={!canDownload}
                onClick={download}
                startIcon={
                  building ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : null
                }
              >
                Télécharger
              </Button>
              {built && (
                <Typography variant="caption" color="text.secondary">
                  {built.fileName} · {formatBytes(built.sizeBytes)}
                </Typography>
              )}
            </Stack>
            {built && (
              <Alert severity={built.hasPdf ? "success" : "info"}>
                Zip prêt : {built.files.join(", ")}.
                {!built.hasPdf && built.pdfReason
                  ? ` PDF source absent (${built.pdfReason}) : l’IA travaillera sur l’image.`
                  : ""}
              </Alert>
            )}
            {buildError && <Alert severity="error">{buildError}</Alert>}
            <Typography variant="body2" color="text.secondary">
              Déposez le zip dans votre outil de chat IA et écrivez :
              « Suis les instructions contenues dans le zip ». Le zip contient
              les consignes, le plan en image, le PDF source s’il existe et les
              modèles de la liste.
            </Typography>

            <Typography variant="subtitle2" sx={{ pt: 1 }}>
              3. Coller le résultat
            </Typography>
            <TextField
              label="Collez ici le JSON renvoyé par l’IA"
              multiline
              minRows={3}
              maxRows={8}
              fullWidth
              value={pasted}
              onChange={handleChange}
              onPaste={handlePaste}
              disabled={busy || !baseMap?.id || !listingId}
              placeholder='{"version":"1.0","coordinateSpace":"image",…}'
              inputProps={{ spellCheck: false }}
            />
            {busy && (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={14} />
                <Typography variant="caption" color="text.secondary">
                  Création des annotations…
                </Typography>
              </Stack>
            )}
            {error && <Alert severity="error">{error}</Alert>}
            {lastResult && (
              <Alert
                severity="success"
                action={
                  <Button color="inherit" size="small" onClick={undo} disabled={busy}>
                    Annuler
                  </Button>
                }
              >
                {created} créés.
                {lastResult.note ? ` Note de l’IA : ${lastResult.note}` : ""}
              </Alert>
            )}
            {dropWarning && <Alert severity="warning">{dropWarning}</Alert>}
            <Typography variant="caption" color="text.secondary">
              Les annotations sont créées dès qu’un JSON complet est collé, dans
              la liste courante et sur le fond affiché. Les modèles déjà présents
              dans le projet sont réutilisés, les autres créés.
            </Typography>
          </Stack>
        </Box>
      )}
    </>
  );
}

ChatPromptIaButton.propTypes = {
  disabled: PropTypes.bool,
};
