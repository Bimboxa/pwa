import { useMemo, useRef, useState } from "react";

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
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";

import useCreateListingFromPromptIa from "../hooks/useCreateListingFromPromptIa";
import buildPromptIaBusinessObjectsZip from "../services/buildPromptIaBusinessObjectsZip";
import parsePromptIaBusinessObjects from "../utils/parsePromptIaBusinessObjects";
import { getBusinessObjectType } from "../data/businessObjectTypesCatalog";
import { extractJsonText } from "Features/promptIa/utils/parsePromptIaOutput";

const INSTRUCTION_MAX_LENGTH = 4000;
const PREVIEW_MAX_ROWS = 500;

function formatBytes(n) {
  if (!(n > 0)) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}

function plural(n, one, many) {
  return `${n} ${n > 1 ? many : one}`;
}

function getFileKey(file) {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

// Prompt IA of a business-object listing: the user drops source files (a
// DPGF workbook…), types an instruction and downloads a zip to hand to an
// external AI chat; the inline JSON pasted back is previewed (objects /
// titles count) and only written — listing + objects — on confirmation.
// The dropped files stay in memory, nothing is stored in the project.
export default function DialogPromptIaBusinessObjects({
  open,
  onClose,
  initialName,
  typeKey,
  canLocateBusinessObjects,
  onCreated,
}) {
  const dispatch = useDispatch();
  const inputRef = useRef(null);
  const { create, busy, error: createError } = useCreateListingFromPromptIa();

  // strings

  const type = getBusinessObjectType(typeKey);
  const objectLabelS = type.strings.objectLabel.toLowerCase();

  const titleS = `Prompt IA — ${type.defaultLabel.toLowerCase()}`;
  const nameStepS = "1. Nom de la liste";
  const nameS = "Nom";
  const filesStepS = "2. Fichiers sources";
  const dropS = "Déposez ici vos fichiers (DPGF Excel, PDF, image…)";
  const addFileS = "Ajouter un fichier";
  const instructionStepS = "3. Instruction et zip";
  const instructionS = "Instruction (optionnelle)";
  const instructionPlaceholderS =
    "Ex. : ne garde que les chapitres 4 et 5, sans les articles non chiffrés.";
  const downloadS = "Télécharger le zip";
  const zipHelperS =
    "Déposez le zip dans votre outil de chat IA (ChatGPT, Claude…) et écrivez : « Suis les instructions contenues dans le zip ».";
  const resultStepS = "4. Résultat";
  const pasteS = "Collez ici le JSON renvoyé par l’IA";
  const cancelS = "Annuler";

  // state

  const [name, setName] = useState(initialName ?? "");
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
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

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    addFiles(e.dataTransfer?.files);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }

  function handleInputChange(e) {
    addFiles(e.target.files);
    e.target.value = "";
  }

  function handleRemoveFile(file) {
    setFiles((current) => current.filter((f) => f !== file));
    setBuilt(null);
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
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragging(false)}
    >
      <DialogTitle>{titleS}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">{nameStepS}</Typography>
          <TextField
            fullWidth
            size="small"
            label={nameS}
            value={name}
            placeholder={(parsed?.ok && parsed.listingName) || ""}
            onChange={(e) => {
              setName(e.target.value);
              setBuilt(null);
            }}
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <Typography variant="subtitle2" sx={{ pt: 1 }}>
            {filesStepS}
          </Typography>
          <Box
            sx={{
              border: "1px dashed",
              borderColor: dragging ? "secondary.main" : "divider",
              bgcolor: dragging ? "action.hover" : "transparent",
              borderRadius: 1,
              p: 1.5,
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ flex: 1 }}
              >
                {dropS}
              </Typography>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                onClick={() => inputRef.current?.click()}
              >
                {addFileS}
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                onChange={handleInputChange}
              />
            </Stack>
            {files.length > 0 && (
              <Stack sx={{ pt: 1 }}>
                {files.map((file) => (
                  <Stack
                    key={getFileKey(file)}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                  >
                    <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                      {file.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatBytes(file.size)}
                    </Typography>
                    <IconButton
                      size="small"
                      aria-label={`Retirer ${file.name}`}
                      onClick={() => handleRemoveFile(file)}
                    >
                      <CloseIcon fontSize="inherit" />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            )}
          </Box>

          <Typography variant="subtitle2" sx={{ pt: 1 }}>
            {instructionStepS}
          </Typography>
          <TextField
            fullWidth
            size="small"
            multiline
            minRows={2}
            maxRows={6}
            label={instructionS}
            placeholder={instructionPlaceholderS}
            value={instruction}
            onChange={(e) => {
              setInstruction(e.target.value);
              setBuilt(null);
            }}
            slotProps={{
              htmlInput: { maxLength: INSTRUCTION_MAX_LENGTH },
              inputLabel: { shrink: true },
            }}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="contained"
              disabled={files.length === 0 || building}
              onClick={handleDownload}
              startIcon={
                building ? <CircularProgress size={14} color="inherit" /> : null
              }
            >
              {downloadS}
            </Button>
            {built && (
              <Typography variant="caption" color="text.secondary">
                {built.fileName} · {formatBytes(built.sizeBytes)}
              </Typography>
            )}
          </Stack>
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
          <Typography variant="body2" color="text.secondary">
            {zipHelperS}
          </Typography>

          <Typography variant="subtitle2" sx={{ pt: 1 }}>
            {resultStepS}
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={3}
            maxRows={6}
            label={pasteS}
            placeholder='{"version":"1.0","businessObjects":[…]}'
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            disabled={busy}
            slotProps={{ htmlInput: { spellCheck: false } }}
          />
          {parsed && !parsed.ok && (
            <Alert severity="error">{parsed.error}</Alert>
          )}
          {parsed?.ok && (
            <>
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
                      bgcolor: item.isTitle ? "action.hover" : "transparent",
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
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {cancelS}
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!canCreate}
          startIcon={
            busy ? <CircularProgress size={14} color="inherit" /> : null
          }
        >
          {createS}
        </Button>
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
