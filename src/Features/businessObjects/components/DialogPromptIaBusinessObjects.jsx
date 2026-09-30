import { useMemo, useState } from "react";

import PropTypes from "prop-types";
import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import StepperPromptIa from "Features/promptIa/components/StepperPromptIa";
import ActionsPromptIaSteps from "Features/promptIa/components/ActionsPromptIaSteps";
import FieldPromptIaContext from "Features/promptIa/components/FieldPromptIaContext";
import FieldPromptIaResultJson from "Features/promptIa/components/FieldPromptIaResultJson";
import ListPromptIaFiles from "Features/promptIa/components/ListPromptIaFiles";
import SectionPromptIaZipDownload from "Features/promptIa/components/SectionPromptIaZipDownload";

import useCreateListingFromPromptIa from "../hooks/useCreateListingFromPromptIa";
import buildPromptIaBusinessObjectsZip from "../services/buildPromptIaBusinessObjectsZip";
import parsePromptIaBusinessObjects from "../utils/parsePromptIaBusinessObjects";
import { getBusinessObjectType } from "../data/businessObjectTypesCatalog";
import { extractJsonText } from "Features/promptIa/utils/parsePromptIaOutput";

const INSTRUCTION_MAX_LENGTH = 4000;
const PREVIEW_MAX_ROWS = 500;

function plural(n, one, many) {
  return `${n} ${n > 1 ? many : one}`;
}

function getFileKey(file) {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

// Prompt IA of a business-object listing, in three steps: context (the
// source files — a DPGF workbook… — and an instruction), zip (handed to an
// external AI chat), result (the JSON given back, pasted or dropped, is
// previewed — objects / titles count — and only written, listing + objects,
// on confirmation). The dropped files stay in memory, nothing is stored in
// the project.
export default function DialogPromptIaBusinessObjects({
  open,
  onClose,
  initialName,
  typeKey,
  canLocateBusinessObjects,
  onCreated,
}) {
  const dispatch = useDispatch();
  const { create, busy, error: createError } = useCreateListingFromPromptIa();

  // strings

  const type = getBusinessObjectType(typeKey);
  const objectLabelS = type.strings.objectLabel.toLowerCase();

  const titleS = `Prompt IA — ${type.defaultLabel.toLowerCase()}`;
  const introS =
    "Joignez vos fichiers sources (DPGF Excel, PDF, image…) et précisez si besoin ce qu’il faut en retenir.";
  const instructionPlaceholderS =
    "Instruction (optionnelle). Ex. : ne garde que les chapitres 4 et 5, sans les articles non chiffrés.";
  const dropHintS = "Glissez-déposez vos fichiers";
  const noFileS =
    "Joignez au moins un fichier source à l’étape « Contexte » pour préparer le zip.";
  const previewS = "Aperçu";
  const nameS = "Nom de la liste";
  const cancelS = "Annuler";

  // state

  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName ?? "");
  const [files, setFiles] = useState([]);
  const [instruction, setInstruction] = useState("");
  const [building, setBuilding] = useState(false);
  const [built, setBuilt] = useState(null);
  const [buildError, setBuildError] = useState(null);
  const [pasted, setPasted] = useState("");

  // helpers

  const parsed = useMemo(() => {
    if (!pasted.trim()) return null;
    const extracted = extractJsonText(pasted);
    if (!extracted.ok)
      return { ok: false, error: extracted.error ?? "JSON introuvable." };
    return parsePromptIaBusinessObjects(extracted.json);
  }, [pasted]);

  // The AI's suggestion only fills an empty name field.
  const effectiveName = name.trim() || (parsed?.ok && parsed.listingName) || "";
  const count = parsed?.ok ? parsed.items.length : 0;
  const canCreate = Boolean(effectiveName) && count > 0 && !busy;

  const createS =
    count > 0
      ? `Créer la liste (${plural(count, "élément", "éléments")})`
      : "Créer la liste";
  const summaryS = parsed?.ok
    ? `${plural(
        parsed.counts.objects,
        objectLabelS,
        `${objectLabelS}s`
      )} et ${plural(parsed.counts.titles, "titre", "titres")} à créer.`
    : "";

  const fileItems = files.map((file) => ({
    key: getFileKey(file),
    label: file.name,
    sizeBytes: file.size,
  }));
  const completed = [files.length > 0, Boolean(built), false];

  // handlers

  function addFiles(fileList) {
    const added = Array.from(fileList ?? []);
    if (added.length === 0) return;
    setFiles((current) => {
      const keys = new Set(current.map(getFileKey));
      return [...current, ...added.filter((f) => !keys.has(getFileKey(f)))];
    });
    setBuilt(null);
  }

  function handleRemoveFile(key) {
    setFiles((current) => current.filter((f) => getFileKey(f) !== key));
    setBuilt(null);
  }

  function handleInstructionChange(text) {
    setInstruction(text);
    setBuilt(null);
  }

  // A file dropped next to the step's target must not make the browser
  // navigate to it.
  function handleStrayDrop(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function handleDownload() {
    setBuilding(true);
    setBuildError(null);
    try {
      const result = await buildPromptIaBusinessObjectsZip({
        listingName: name,
        type,
        instruction,
        files,
      });
      setBuilt(result);
    } catch (err) {
      setBuildError(err?.message ?? String(err));
    } finally {
      setBuilding(false);
    }
  }

  async function handleCreate() {
    if (!canCreate) return;
    const result = await create({
      name: effectiveName,
      typeKey,
      canLocateBusinessObjects,
      items: parsed.items,
    });
    if (!result) return;
    dispatch(
      setToaster({
        message: `Liste « ${result.listing.name} » créée : ${plural(
          result.count,
          "élément",
          "éléments"
        )}.`,
      })
    );
    onCreated?.(result.listing);
    onClose();
  }

  // render

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      // plain-letter hotkeys of the app must not fire while typing here
      onKeyDown={(e) => e.stopPropagation()}
      onDrop={handleStrayDrop}
      onDragOver={handleStrayDrop}
    >
      <DialogTitle>{titleS}</DialogTitle>
      <DialogContent>
        <StepperPromptIa
          activeStep={step}
          onStepChange={setStep}
          completed={completed}
          disabled={busy}
          sx={{ pb: 2 }}
        />
        <Stack spacing={1.5} sx={{ minHeight: 260 }}>
          {step === 0 && (
            <>
              <Typography variant="body2" color="text.secondary">
                {introS}
              </Typography>
              <FieldPromptIaContext
                value={instruction}
                onChange={handleInstructionChange}
                placeholder={instructionPlaceholderS}
                maxLength={INSTRUCTION_MAX_LENGTH}
                onFiles={addFiles}
                hint={dropHintS}
              >
                <ListPromptIaFiles
                  items={fileItems}
                  onRemove={handleRemoveFile}
                />
              </FieldPromptIaContext>
            </>
          )}

          {step === 1 && (
            <SectionPromptIaZipDownload
              onDownload={handleDownload}
              disabled={files.length === 0}
              building={building}
              built={built}
            >
              {files.length === 0 && <Alert severity="info">{noFileS}</Alert>}
              {built && (
                <Alert severity="success">
                  Zip prêt : {built.files.join(", ")}.
                </Alert>
              )}
              {built?.warnings.map((message) => (
                <Alert key={message} severity="warning">
                  {message}
                </Alert>
              ))}
              {buildError && <Alert severity="error">{buildError}</Alert>}
            </SectionPromptIaZipDownload>
          )}

          {step === 2 && (
            <>
              <FieldPromptIaResultJson
                value={pasted}
                onChange={setPasted}
                placeholder='{"version":"1.0","businessObjects":[…]}'
                disabled={busy}
              />
              {parsed && !parsed.ok && (
                <Alert severity="error">{parsed.error}</Alert>
              )}
              {parsed?.ok && (
                <>
                  <Typography variant="subtitle2" sx={{ pt: 1 }}>
                    {previewS}
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    label={nameS}
                    value={name}
                    placeholder={parsed.listingName || ""}
                    onChange={(e) => setName(e.target.value)}
                    disabled={busy}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <Alert severity="info">
                    {summaryS}
                    {parsed.note ? ` Note de l’IA : ${parsed.note}` : ""}
                  </Alert>
                  {parsed.warnings.map((message) => (
                    <Alert key={message} severity="warning">
                      {message}
                    </Alert>
                  ))}
                  <Box
                    sx={{
                      maxHeight: 240,
                      overflowY: "auto",
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      py: 0.5,
                    }}
                  >
                    {parsed.items.slice(0, PREVIEW_MAX_ROWS).map((item) => (
                      <Stack
                        key={item.ref}
                        direction="row"
                        spacing={1}
                        alignItems="baseline"
                        sx={{
                          pl: 1 + item.depth * 2,
                          pr: 1,
                          py: 0.25,
                          bgcolor: item.isTitle
                            ? "action.hover"
                            : "transparent",
                        }}
                      >
                        {item.code && (
                          <Typography variant="caption" color="text.secondary">
                            {item.code}
                          </Typography>
                        )}
                        <Typography
                          variant="body2"
                          sx={{
                            flex: 1,
                            fontWeight: item.isTitle ? "bold" : "normal",
                          }}
                        >
                          {item.label}
                        </Typography>
                        {!item.isTitle &&
                          (item.refQty != null || item.unit) && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              noWrap
                            >
                              {[item.refQty, item.unit]
                                .filter((v) => v != null)
                                .join(" ")}
                            </Typography>
                          )}
                      </Stack>
                    ))}
                    {parsed.items.length > PREVIEW_MAX_ROWS && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ pl: 1 }}
                      >
                        … {parsed.items.length - PREVIEW_MAX_ROWS} de plus
                      </Typography>
                    )}
                  </Box>
                </>
              )}
              {createError && <Alert severity="error">{createError}</Alert>}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose} disabled={busy}>
          {cancelS}
        </Button>
        <ActionsPromptIaSteps
          activeStep={step}
          onBack={() => setStep(step - 1)}
          onNext={() => setStep(step + 1)}
          nextDisabled={step === 0 && files.length === 0}
          backDisabled={busy}
          sx={{ flex: 1 }}
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
              {createS}
            </Button>
          }
        />
      </DialogActions>
    </Dialog>
  );
}

DialogPromptIaBusinessObjects.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  initialName: PropTypes.string,
  typeKey: PropTypes.string,
  canLocateBusinessObjects: PropTypes.bool,
  onCreated: PropTypes.func,
};
