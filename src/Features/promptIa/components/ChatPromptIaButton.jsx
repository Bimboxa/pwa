import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import PropTypes from "prop-types";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";

import useDetailBaseMaps from "Features/baseMaps/hooks/useDetailBaseMaps";
import DialogSelectPdfResource from "Features/resources/components/DialogSelectPdfResource";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import { getVisibleListingTemplates } from "Features/chat/utils/buildAutoDetectionContext";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import useApplyPromptIaOutput from "../hooks/useApplyPromptIaOutput";
import usePromptIaAttachments from "../hooks/usePromptIaAttachments";
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
  const [details, setDetails] = useState(false);
  const [description, setDescription] = useState("");
  const [attachErrors, setAttachErrors] = useState([]);
  const [attaching, setAttaching] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [openResources, setOpenResources] = useState(false);
  const fileInputRef = useRef(null);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState(null);
  const [built, setBuilt] = useState(null);
  const [pasted, setPasted] = useState("");
  const [dropWarning, setDropWarning] = useState(null);
  const appliedTextRef = useRef("");
  const timerRef = useRef(null);

  const { apply, undo, busy, error, lastResult, clearError } =
    useApplyPromptIaOutput();
  const { attachments, attachFiles, attachExisting, detach, loadFiles } =
    usePromptIaAttachments();
  const detailBaseMaps = useDetailBaseMaps();
  const hasPdfAttachment = attachments.some((a) => a.isPdf && a.hasFile);

  // Default the templates box to what the list offers, once known.
  useEffect(() => {
    if (!open) return;
    if (!hasVisibleTemplates && fromTemplates && !free && !details) {
      setFromTemplates(false);
      setFree(true);
    }
  }, [open]);

  const valid =
    (fromTemplates || free || details) &&
    (!fromTemplates || hasVisibleTemplates) &&
    (!free || Boolean(description.trim())) &&
    (!details || hasPdfAttachment);
  // Only the detection needs the scale (thicknesses in centimetres): a
  // carnet de détails alone places bubbles, whatever the calibration.
  const needsScale = fromTemplates || free;
  const canDownload =
    valid &&
    (calibrated || !needsScale) &&
    Boolean(baseMap?.id && listingId) &&
    !building &&
    !attaching;

  async function handleAttachFiles(files) {
    if (!files?.length) return;
    setAttaching(true);
    try {
      const { errors } = await attachFiles(files);
      setAttachErrors(errors);
      setBuilt(null);
    } finally {
      setAttaching(false);
    }
  }

  function handleDrop(e) {
    // Never let the chat panel underneath take the files.
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    handleAttachFiles(e.dataTransfer?.files);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  async function handleSelectResource(resource) {
    const ok = await attachExisting(resource);
    if (!ok) return false;
    setBuilt(null);
    setOpenResources(false);
    return true;
  }

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
        mode: {
          fromTemplates,
          free,
          details,
          description: description.trim(),
        },
        attachments: await loadFiles(),
        detailBaseMaps: detailBaseMaps ?? [],
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
  const createdBaseMaps = lastResult?.createdBaseMapIds?.length ?? 0;
  const reusedBaseMaps = lastResult?.reusedBaseMapIds?.length ?? 0;
  const baseMapsSummary =
    createdBaseMaps || reusedBaseMaps
      ? ` ${plural(createdBaseMaps, "fond de détail créé", "fonds de détail créés")}${
          reusedBaseMaps
            ? ` (${plural(reusedBaseMaps, "réutilisé", "réutilisés")})`
            : ""
        }.`
      : "";

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
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setDragOver(false)}
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
            <Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={details}
                    onChange={(e) => setDetails(e.target.checked)}
                  />
                }
                label="Carnet de détails"
              />
              <Typography variant="body2" color="text.secondary">
                L’IA place une pastille de détail sur le plan pour chaque
                détail repéré et crée le fond de détail correspondant (page et
                zone) à partir du PDF joint.
              </Typography>
            </Box>
            {(free || details) && (
              <TextField
                label="Que faut-il repérer ?"
                multiline
                minRows={3}
                fullWidth
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                inputProps={{ maxLength: 4000 }}
                placeholder={
                  free
                    ? "Exemple : repérer les portes, les fenêtres et les poteaux…"
                    : "Facultatif. Exemple : repérer les acrotères et les relevés d’étanchéité, un détail par type…"
                }
              />
            )}
            {fromTemplates && !hasVisibleTemplates && (
              <Alert severity="warning">
                Cette liste ne contient aucun modèle visible. Choisissez la
                détection libre seule ou ajoutez des modèles.
              </Alert>
            )}
            {!calibrated && needsScale && (
              <Alert severity="warning">
                Ce fond de plan n’est pas calibré (échelle inconnue). Calibrez-le
                avant de préparer le zip : les épaisseurs en centimètres en
                dépendent.
              </Alert>
            )}

            <Typography variant="subtitle2" sx={{ pt: 1 }}>
              2. Pièces jointes
            </Typography>
            <Box
              sx={{
                p: 1.5,
                border: "1px dashed",
                borderColor: dragOver ? "primary.main" : "divider",
                borderRadius: 1,
                bgcolor: dragOver ? "action.hover" : "transparent",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Déposez ici le PDF du carnet de détails (ou tout document utile
                à l’IA). 50 Mo au plus par fichier. Les fichiers joints sont
                enregistrés dans les ressources du projet.
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  disabled={attaching}
                  onClick={() => fileInputRef.current?.click()}
                  startIcon={
                    attaching ? (
                      <CircularProgress size={12} color="inherit" />
                    ) : null
                  }
                >
                  Ajouter un fichier
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  disabled={attaching}
                  onClick={() => setOpenResources(true)}
                >
                  Choisir une ressource
                </Button>
              </Stack>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                multiple
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  handleAttachFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              {attachments.length > 0 && (
                <Stack spacing={0.5} sx={{ mt: 1.5 }}>
                  {attachments.map(({ resource, hasFile }) => (
                    <Stack
                      key={resource.id}
                      direction="row"
                      spacing={1}
                      alignItems="center"
                    >
                      <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                        {resource.name}
                      </Typography>
                      {!hasFile && (
                        <Chip
                          size="small"
                          color="warning"
                          variant="outlined"
                          label="fichier absent"
                        />
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {formatBytes(resource.fileSize)}
                      </Typography>
                      <IconButton
                        size="small"
                        aria-label={`Retirer ${resource.name}`}
                        onClick={() => {
                          detach(resource);
                          setBuilt(null);
                        }}
                      >
                        <CloseIcon fontSize="inherit" />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>
            {attachErrors.map((message) => (
              <Alert
                key={message}
                severity="error"
                onClose={() =>
                  setAttachErrors((list) => list.filter((m) => m !== message))
                }
              >
                {message}
              </Alert>
            ))}
            {details && !hasPdfAttachment && (
              <Alert severity="warning">
                Joignez le PDF du carnet de détails : les fonds de détail sont
                extraits de ses pages.
              </Alert>
            )}

            <Typography variant="subtitle2" sx={{ pt: 1 }}>
              3. Préparer le zip
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
              les consignes, le plan en image, le PDF source s’il existe, les
              modèles de la liste et les pièces jointes.
            </Typography>

            <Typography variant="subtitle2" sx={{ pt: 1 }}>
              4. Coller le résultat
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
                {created} créés.{baseMapsSummary}
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
          <DialogSelectPdfResource
            open={openResources}
            onClose={() => setOpenResources(false)}
            onSelect={handleSelectResource}
          />
        </Box>
      )}
    </>
  );
}

ChatPromptIaButton.propTypes = {
  disabled: PropTypes.bool,
};
