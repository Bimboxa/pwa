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
  Stack,
  Typography,
} from "@mui/material";

import useDetailBaseMaps from "Features/baseMaps/hooks/useDetailBaseMaps";
import DialogSelectPdfResource from "Features/resources/components/DialogSelectPdfResource";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import { getVisibleListingTemplates } from "Features/chat/utils/buildAutoDetectionContext";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import ActionsPromptIaSteps from "./ActionsPromptIaSteps";
import FieldPromptIaContext from "./FieldPromptIaContext";
import FieldPromptIaResultJson from "./FieldPromptIaResultJson";
import ListPromptIaFiles from "./ListPromptIaFiles";
import SectionPromptIaZipDownload from "./SectionPromptIaZipDownload";
import StepperPromptIa from "./StepperPromptIa";

import useApplyPromptIaOutput from "../hooks/useApplyPromptIaOutput";
import usePromptIaAttachments from "../hooks/usePromptIaAttachments";
import buildPromptIaZip from "../services/buildPromptIaZip";

const PREPARE_DEBOUNCE_MS = 300;
const DESCRIPTION_MAX_LENGTH = 4000;
const ATTACH_ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";

function plural(n, one, many) {
  return `${n} ${n > 1 ? many : one}`;
}

/**
 * « Prompt IA »: prepares a self-contained zip (instructions + plan) for an
 * external AI chat, and applies the JSON the chat gives back. No relay.
 * Three steps: context (what to detect, attachments), zip, result (the JSON
 * is previewed, then imported on confirmation).
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
  const [step, setStep] = useState(0);
  const [fromTemplates, setFromTemplates] = useState(true);
  const [free, setFree] = useState(false);
  const [details, setDetails] = useState(false);
  const [description, setDescription] = useState("");
  const [attachErrors, setAttachErrors] = useState([]);
  const [attaching, setAttaching] = useState(false);
  const [openResources, setOpenResources] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState(null);
  const [built, setBuilt] = useState(null);
  const [pasted, setPasted] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState(null);
  const [dropWarning, setDropWarning] = useState(null);
  const requestRef = useRef(0);
  const timerRef = useRef(null);

  const { prepare, apply, undo, busy, error, lastResult, clearError } =
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

  // The preview only holds for the base map / listing it was read against.
  const previewStale =
    Boolean(prepared) &&
    (prepared.listingId !== listingId || prepared.baseMapId !== baseMap?.id);
  const preview = prepared && !previewStale ? prepared.preview : null;
  const canCreate = Boolean(preview) && !busy && !preparing;

  const attachmentItems = attachments.map(({ resource, hasFile }) => ({
    key: resource.id,
    label: resource.name,
    sizeBytes: resource.fileSize,
    warning: hasFile ? null : "fichier absent",
  }));

  const descriptionPlaceholder = free
    ? "Que faut-il repérer ? Exemple : repérer les portes, les fenêtres et les poteaux…"
    : details
      ? "Que faut-il repérer ? Facultatif. Exemple : repérer les acrotères et les relevés d’étanchéité, un détail par type…"
      : "Précisions (facultatif). Exemple : ne traiter que la zone nord du plan…";

  const completed = [valid, Boolean(built), Boolean(lastResult)];

  const previewChips = preview
    ? [
        plural(preview.annotations, "annotation", "annotations"),
        ...(preview.newTemplates > 0
          ? [plural(preview.newTemplates, "modèle à créer", "modèles à créer")]
          : []),
        ...(preview.reusedTemplates > 0
          ? [
              plural(
                preview.reusedTemplates,
                "modèle existant",
                "modèles existants"
              ),
            ]
          : []),
        ...(preview.newBaseMaps > 0
          ? [
              plural(
                preview.newBaseMaps,
                "fond de détail à créer",
                "fonds de détail à créer"
              ),
            ]
          : []),
        ...(preview.reusedBaseMaps > 0
          ? [
              plural(
                preview.reusedBaseMaps,
                "fond de détail réutilisé",
                "fonds de détail réutilisés"
              ),
            ]
          : []),
      ]
    : [];

  function handleModeChange(setter) {
    return (e) => {
      setter(e.target.checked);
      setBuilt(null);
    };
  }

  function handleDescriptionChange(text) {
    setDescription(text);
    setBuilt(null);
  }

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

  function handleDetach(resourceId) {
    const attachment = attachments.find((a) => a.resource.id === resourceId);
    if (!attachment) return;
    detach(attachment.resource);
    setBuilt(null);
  }

  function handleDrop(e) {
    // Never let the chat panel underneath take the files: on the context
    // step they are attachments wherever they land.
    e.preventDefault();
    e.stopPropagation();
    if (step === 0) handleAttachFiles(e.dataTransfer?.files);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
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

  // The pasted / dropped JSON is only read here: nothing is written before
  // the user confirms the preview.
  function handleResultChange(text) {
    setPasted(text);
    setPrepared(null);
    if (error) clearError();
    clearTimeout(timerRef.current);
    const request = ++requestRef.current;
    if (!text.trim()) {
      setPreparing(false);
      return;
    }
    setPreparing(true);
    timerRef.current = setTimeout(async () => {
      const outcome = await prepare(text);
      // a newer input took over
      if (request !== requestRef.current) return;
      setPreparing(false);
      setPrepared(outcome.ok ? outcome.prepared : null);
    }, PREPARE_DEBOUNCE_MS);
  }

  async function handleCreate() {
    if (!canCreate) return;
    const outcome = await apply(prepared);
    if (!outcome.ok) return;
    requestRef.current += 1;
    setPasted("");
    setPrepared(null);
    setDropWarning(
      outcome.result.droppedIds.length
        ? `${plural(outcome.result.droppedIds.length, "annotation écartée", "annotations écartées")} (hors du cadre du fond).`
        : null
    );
  }

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const created = lastResult
    ? `${plural(lastResult.placedIds.length, "annotation", "annotations")} et ${plural(
        lastResult.createdTemplateIds.length +
          lastResult.reusedTemplateIds.length,
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
            <StepperPromptIa
              activeStep={step}
              onStepChange={setStep}
              completed={completed}
              disabled={busy}
              sx={{ mt: 1.5 }}
            />
          </Box>
          <Stack spacing={1.5} sx={{ p: 2, flex: 1, overflowY: "auto" }}>
            {step === 0 && (
              <>
                <Typography variant="subtitle2">Que détecter ?</Typography>
                <Box>
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={fromTemplates}
                        onChange={handleModeChange(setFromTemplates)}
                      />
                    }
                    label="Détection à partir des modèles de la liste"
                  />
                  <Typography variant="body2" color="text.secondary">
                    Repérer les modèles visibles de la liste courante, avec
                    leurs descriptions et les annotations déjà dessinées comme
                    exemples.
                  </Typography>
                </Box>
                <Box>
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={free}
                        onChange={handleModeChange(setFree)}
                      />
                    }
                    label="Détection libre"
                  />
                  <Typography variant="body2" color="text.secondary">
                    L’IA choisit les types d’annotations et définit les nouveaux
                    modèles à partir de votre description. Ils seront créés dans
                    la liste courante.
                  </Typography>
                </Box>
                <Box>
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={details}
                        onChange={handleModeChange(setDetails)}
                      />
                    }
                    label="Carnet de détails"
                  />
                  <Typography variant="body2" color="text.secondary">
                    L’IA place une pastille de détail sur le plan pour chaque
                    détail repéré et crée le fond de détail correspondant (page
                    et zone) à partir du PDF joint.
                  </Typography>
                </Box>

                <FieldPromptIaContext
                  value={description}
                  onChange={handleDescriptionChange}
                  placeholder={descriptionPlaceholder}
                  maxLength={DESCRIPTION_MAX_LENGTH}
                  accept={ATTACH_ACCEPT}
                  onFiles={handleAttachFiles}
                  extraAttachActions={[
                    {
                      label: "Choisir une ressource",
                      onClick: () => setOpenResources(true),
                    },
                  ]}
                  hint="Glissez-déposez un PDF ou une image"
                  loading={attaching}
                >
                  <ListPromptIaFiles
                    items={attachmentItems}
                    onRemove={handleDetach}
                  />
                </FieldPromptIaContext>
                <Typography variant="caption" color="text.secondary">
                  Joignez le PDF du carnet de détails ou tout document utile à
                  l’IA : 50 Mo au plus par fichier. Les fichiers joints sont
                  enregistrés dans les ressources du projet.
                </Typography>

                {attachErrors.map((message) => (
                  <Alert
                    key={message}
                    severity="error"
                    onClose={() =>
                      setAttachErrors((list) =>
                        list.filter((m) => m !== message)
                      )
                    }
                  >
                    {message}
                  </Alert>
                ))}
                {fromTemplates && !hasVisibleTemplates && (
                  <Alert severity="warning">
                    Cette liste ne contient aucun modèle visible. Choisissez la
                    détection libre seule ou ajoutez des modèles.
                  </Alert>
                )}
                {free && !description.trim() && (
                  <Alert severity="info">
                    Détection libre : décrivez ce qu’il faut repérer.
                  </Alert>
                )}
                {details && !hasPdfAttachment && (
                  <Alert severity="warning">
                    Joignez le PDF du carnet de détails : les fonds de détail
                    sont extraits de ses pages.
                  </Alert>
                )}
                {!calibrated && needsScale && (
                  <Alert severity="warning">
                    Ce fond de plan n’est pas calibré (échelle inconnue).
                    Calibrez-le avant de préparer le zip : les épaisseurs en
                    centimètres en dépendent.
                  </Alert>
                )}
              </>
            )}

            {step === 1 && (
              <>
                <SectionPromptIaZipDownload
                  onDownload={download}
                  disabled={!canDownload}
                  building={building}
                  built={built}
                >
                  {!canDownload && !building && (
                    <Alert severity="info">
                      Complétez l’étape « Contexte » pour préparer le zip.
                    </Alert>
                  )}
                  {built && (
                    <Alert severity={built.hasPdf ? "success" : "info"}>
                      Zip prêt : {built.files.join(", ")}.
                      {!built.hasPdf && built.pdfReason
                        ? ` PDF source absent (${built.pdfReason}) : l’IA travaillera sur l’image.`
                        : ""}
                    </Alert>
                  )}
                  {buildError && <Alert severity="error">{buildError}</Alert>}
                </SectionPromptIaZipDownload>
                <Typography variant="caption" color="text.secondary">
                  Le zip contient les consignes, le plan en image, le PDF source
                  s’il existe, les modèles de la liste et les pièces jointes.
                </Typography>
              </>
            )}

            {step === 2 && (
              <>
                <FieldPromptIaResultJson
                  value={pasted}
                  onChange={handleResultChange}
                  placeholder='{"version":"1.0","coordinateSpace":"image",…}'
                  disabled={busy || !baseMap?.id || !listingId}
                />
                {preparing && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={14} />
                    <Typography variant="caption" color="text.secondary">
                      Lecture du résultat…
                    </Typography>
                  </Stack>
                )}
                {error && <Alert severity="error">{error}</Alert>}
                {previewStale && (
                  <Alert severity="warning">
                    Le fond de plan ou la liste a changé : collez à nouveau le
                    résultat.
                  </Alert>
                )}
                {preview && (
                  <>
                    <Typography variant="subtitle2" sx={{ pt: 1 }}>
                      Aperçu
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {previewChips.map((label) => (
                        <Chip key={label} label={label} size="small" />
                      ))}
                    </Box>
                    {preview.byTemplate.length > 0 && (
                      <Box
                        sx={{
                          maxHeight: 200,
                          overflowY: "auto",
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 1,
                          py: 0.5,
                        }}
                      >
                        {preview.byTemplate.map((row) => (
                          <Stack
                            key={row.id}
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={{ px: 1, py: 0.25 }}
                          >
                            <Typography
                              variant="body2"
                              noWrap
                              sx={{ flex: 1, minWidth: 0 }}
                            >
                              {row.label}
                            </Typography>
                            {row.isNew && (
                              <Chip
                                size="small"
                                variant="outlined"
                                label="nouveau"
                              />
                            )}
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {row.count}
                            </Typography>
                          </Stack>
                        ))}
                      </Box>
                    )}
                    {preview.dropped > 0 && (
                      <Alert severity="warning">
                        {plural(
                          preview.dropped,
                          "annotation écartée",
                          "annotations écartées"
                        )}{" "}
                        (hors du cadre du fond).
                      </Alert>
                    )}
                    {preview.note && (
                      <Alert severity="info">
                        Note de l’IA : {preview.note}
                      </Alert>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      Les annotations seront créées dans «{" "}
                      {listing?.name ?? "la liste courante"} », sur le fond
                      affiché. Les modèles déjà présents dans le projet sont
                      réutilisés, les autres créés.
                    </Typography>
                  </>
                )}
                {busy && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={14} />
                    <Typography variant="caption" color="text.secondary">
                      Création des annotations…
                    </Typography>
                  </Stack>
                )}
                {lastResult && (
                  <Alert
                    severity="success"
                    action={
                      <Button
                        color="inherit"
                        size="small"
                        onClick={undo}
                        disabled={busy}
                      >
                        Annuler
                      </Button>
                    }
                  >
                    {created} créés.{baseMapsSummary}
                    {lastResult.note
                      ? ` Note de l’IA : ${lastResult.note}`
                      : ""}
                  </Alert>
                )}
                {dropWarning && <Alert severity="warning">{dropWarning}</Alert>}
              </>
            )}
          </Stack>
          <ActionsPromptIaSteps
            activeStep={step}
            onBack={() => setStep(step - 1)}
            onNext={() => setStep(step + 1)}
            nextDisabled={step === 0 && !canDownload}
            backDisabled={busy}
            sx={{
              p: 1.5,
              borderTop: "1px solid",
              borderColor: "divider",
            }}
            finalAction={
              <Button
                variant="contained"
                color="secondary"
                onClick={handleCreate}
                disabled={!canCreate}
                startIcon={
                  busy ? <CircularProgress size={14} color="inherit" /> : null
                }
              >
                Créer les annotations
              </Button>
            }
          />
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
