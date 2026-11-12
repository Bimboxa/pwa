import { useEffect, useMemo, useRef, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";
import { setCutLinesPromptMaxArea } from "Features/threedEditor/threedEditorSlice";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useDrawingPreferredBaseMapId from "Features/threedDrawing/hooks/useDrawingPreferredBaseMapId";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Typography,
} from "@mui/material";
import { Check, ContentCopy, Download } from "@mui/icons-material";

import FieldAnnotationHeight from "Features/annotations/components/FieldAnnotationHeight";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import FieldPromptIaResultJson from "Features/promptIa/components/FieldPromptIaResultJson";
import SectionPromptIaZipDownload from "Features/promptIa/components/SectionPromptIaZipDownload";

import downloadBlob from "Features/files/utils/downloadBlob";
import { extractJsonText } from "Features/promptIa/utils/parsePromptIaOutput";
import buildCutLinesPromptZip from "Features/threedCutLines/services/buildCutLinesPromptZip";
import collectCutLinesPromptRegions from "Features/threedCutLines/services/collectCutLinesPromptRegions";
import computeCutLinesPromptPreview from "Features/threedCutLines/services/computeCutLinesPromptPreview";
import createCutLinesFromPromptService from "Features/threedCutLines/services/createCutLinesFromPromptService";
import { getCutLinesWorldPolylines } from "Features/threedCutLines/services/cutLineObjectsStore";
import buildCutLinesPromptContext, {
  CUT_LINES_PROMPT_MODES,
} from "Features/threedCutLines/utils/buildCutLinesPromptContext";
import buildCutLinesPromptMarkdown from "Features/threedCutLines/utils/buildCutLinesPromptMarkdown";
import parseCutLinesPromptResult from "Features/threedCutLines/utils/parseCutLinesPromptResult";
import filterBaseMapsShownIn3d from "Features/threedDrawing/utils/filterBaseMapsShownIn3d";

import textInstructions from "../../../../../docs/threed/CUT_LINES_PROMPT.md?raw";
import glbInstructions from "../../../../../docs/threed/CUT_LINES_PROMPT_GLB.md?raw";

const { TEXT, GLB } = CUT_LINES_PROMPT_MODES;
const PROMPT_FILE = "prompt-lignes-de-coupe.md";
const COPIED_MS = 1500;
const PREVIEW_DEBOUNCE_MS = 300;
const MAX_WARNINGS = 5;

const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;
const formatArea = (v) => `${v.toFixed(2).replace(".", ",")} m²`;

// Dialog of « Ligne de coupe – prompt IA » (Maillage module):
// 1. target max surface of a maille (one-liner field, on the row of the
//    prompt button);
// 2. the prompt for an external AI chat — TEXT mode (planar faces only: one
//    text to copy / download) or GLB mode (curved surfaces: a zip with
//    scene.glb), with the faces of the visible annotations and the cut lines
//    already drawn. The mode is picked from the scene, never by the user;
// 3. the pasted answer, parsed live, with a dry run of the resulting pieces;
// 4. « Créer » writes the cut lines and the set-out cotes in one undo step.
//
// The scene is read ONCE, when the dialog mounts (the button mounts it on
// opening). onKeyDown stops the propagation so the toolbar hotkeys stay
// quiet while the dialog is open.
export default function DialogCutLinesPromptIa({ open, onClose, editor }) {
  // strings

  const titleS = "Ligne de coupe – prompt IA";
  const maxAreaS = "Surface max d’une maille";
  const copyS = "Copier le prompt";
  const copiedS = "Prompt copié";
  const downloadS = "Télécharger";
  const pasteHintS =
    "Collez ce prompt dans un chat IA (ChatGPT, Claude…), puis collez sa réponse ci-dessous.";
  const noSolidS = "Aucune annotation visible dans l’éditeur 3D.";
  const invalidMaxS = "Saisissez une surface supérieure à 0.";
  const zipFollowUpS =
    "L’IA vous renverra un JSON à coller (ou un fichier .json à déposer) ci-dessous.";
  const closeS = "Fermer";
  const createS = "Créer les lignes de coupe";
  const errorS = "Création des lignes de coupe impossible";
  const zipErrorS = "Génération du zip impossible";

  // data

  const dispatch = useDispatch();
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const angleDeg = useSelector((s) => s.threedEditor.faceSelectionAngleDeg);
  const storedMaxArea = useSelector(
    (s) => s.threedEditor.cutLinesPromptMaxArea
  );
  const baseMaps = useBaseMaps()?.value;
  const preferredBaseMapId = useDrawingPreferredBaseMapId();

  // state

  // Snapshot of the scene, read once on mount.
  const [regions] = useState(() =>
    collectCutLinesPromptRegions({ editor, angleDeg })
  );
  const [existingCutLines] = useState(() => getCutLinesWorldPolylines());
  // Number, or null while the field is empty.
  const [maxArea, setMaxArea] = useState(storedMaxArea ?? 4);
  const [pasted, setPasted] = useState("");
  const [copied, setCopied] = useState(false);
  const [building, setBuilding] = useState(false);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const copiedTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(copiedTimerRef.current), []);

  // helpers

  // The mode is a technical choice, never shown: a zip with the scene as a
  // GLB as soon as one visible surface is curved, plain text otherwise.
  const mode = useMemo(
    () => (regions.some((region) => region.shell) ? GLB : TEXT),
    [regions]
  );
  const maxAreaIsValid = Number.isFinite(maxArea) && maxArea > 0;
  // FieldAnnotationHeight edits one numeric key of a record.
  const maxAreaRecord = useMemo(
    () => ({ id: "cutLinesPrompt", maxArea }),
    [maxArea]
  );

  const prompt = useMemo(
    () =>
      buildCutLinesPromptContext({
        regions,
        cutLines: existingCutLines,
        maxArea: maxAreaIsValid ? maxArea : 0,
        mode,
      }),
    [regions, existingCutLines, maxArea, maxAreaIsValid, mode]
  );
  const { stats } = prompt;
  const isGlb = mode === GLB;
  const hasInput = isGlb
    ? stats.faceCount + stats.curvedCount > 0
    : stats.faceCount > 0;
  const canBuildPrompt = maxAreaIsValid && hasInput;

  const parsed = useMemo(() => {
    const extracted = extractJsonText(pasted);
    if (!extracted.ok) return { ok: false, error: extracted.error };
    return parseCutLinesPromptResult({
      json: extracted.json,
      vertexById: prompt.vertexById,
      edgeKeys: prompt.edgeKeys,
      mode,
    });
  }, [pasted, prompt, mode]);

  // Dry run of the proposed lines (debounced: it clips every face region).
  useEffect(() => {
    if (!parsed.ok || !maxAreaIsValid) {
      setPreview(null);
      return undefined;
    }
    const timer = setTimeout(() => {
      try {
        setPreview(
          computeCutLinesPromptPreview({
            editor,
            angleDeg,
            lines: parsed.lines,
            maxArea,
          })
        );
      } catch (err) {
        console.error("[threedCutLines] prompt preview failed", err);
        setPreview(null);
      }
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [parsed, maxArea, maxAreaIsValid, editor, angleDeg]);

  const statsS = [
    `${plural(stats.faceCount, "face")} plane${stats.faceCount > 1 ? "s" : ""}` +
      (stats.faceCount ? `, dont ${stats.facesToCut} à découper` : ""),
    `${plural(stats.curvedCount, "surface")} courbe${stats.curvedCount > 1 ? "s" : ""}`,
    `${plural(stats.cutLineCount, "ligne")} existante${stats.cutLineCount > 1 ? "s" : ""}`,
  ].join(" · ");

  const getPromptText = () =>
    buildCutLinesPromptMarkdown({
      instructions: textInstructions,
      context: prompt.context,
    });

  // handlers

  function handleMaxAreaChange(record) {
    const value = record?.maxArea ?? null;
    setMaxArea(value);
    if (Number.isFinite(value) && value > 0) {
      dispatch(setCutLinesPromptMaxArea(value));
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(getPromptText());
      setCopied(true);
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch (err) {
      console.error("[threedCutLines] prompt copy failed", err);
    }
  }

  function handleDownloadText() {
    downloadBlob(
      new Blob([getPromptText()], { type: "text/markdown" }),
      PROMPT_FILE
    );
  }

  async function handleDownloadZip() {
    setBuilding(true);
    try {
      const zip = await buildCutLinesPromptZip({
        editor,
        instructions: buildCutLinesPromptMarkdown({
          instructions: glbInstructions,
          context: prompt.context,
          embedContext: false,
        }),
        context: prompt.context,
      });
      if (!zip)
        dispatch(setToaster({ message: noSolidS, severity: "warning" }));
    } catch (err) {
      console.error("[threedCutLines] prompt zip failed", err);
      dispatch(setToaster({ message: zipErrorS, severity: "error" }));
    } finally {
      setBuilding(false);
    }
  }

  async function handleCreate() {
    if (!parsed.ok || busy) return;
    setBusy(true);
    try {
      const { lineCount, coteCount, skippedCount } =
        await createCutLinesFromPromptService({
          lines: parsed.lines,
          cotes: parsed.cotes,
          baseMaps: filterBaseMapsShownIn3d(editor, baseMaps),
          projectId,
          scopeId,
          preferredBaseMapId,
          dispatch,
        });
      const parts = [
        `${plural(lineCount, "ligne")} de coupe créée${lineCount > 1 ? "s" : ""}`,
      ];
      if (coteCount) parts.push(plural(coteCount, "cote"));
      if (skippedCount) {
        parts.push(`${skippedCount} hors fond de plan`);
      }
      dispatch(
        setToaster({
          message: parts.join(" · "),
          severity: lineCount ? "success" : "warning",
        })
      );
      if (lineCount) onClose?.();
    } catch (err) {
      console.error("[threedCutLines] prompt create failed", err);
      dispatch(setToaster({ message: errorS, severity: "error" }));
    } finally {
      setBusy(false);
    }
  }

  // render

  const warnings = parsed.warnings ?? [];
  const maxAreaField = (
    <FieldAnnotationHeight
      annotation={maxAreaRecord}
      onChange={handleMaxAreaChange}
      field="maxArea"
      label={maxAreaS}
      unit="m²"
    />
  );

  return (
    <DialogGeneric
      open={open}
      onClose={busy ? undefined : onClose}
      title={titleS}
      width={560}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2,
          px: 3,
          pb: 2,
          overflowY: "auto",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {statsS}
        </Typography>

        {!maxAreaIsValid && <Alert severity="warning">{invalidMaxS}</Alert>}
        {!hasInput && <Alert severity="warning">{noSolidS}</Alert>}

        {isGlb ? (
          <SectionPromptIaZipDownload
            onDownload={handleDownloadZip}
            disabled={!canBuildPrompt}
            building={building}
            followUp={zipFollowUpS}
            startSlot={maxAreaField}
          />
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {maxAreaField}
              <Button
                variant="contained"
                color="secondary"
                onClick={handleCopy}
                disabled={!canBuildPrompt}
                startIcon={copied ? <Check /> : <ContentCopy />}
                sx={{ flexShrink: 0 }}
              >
                {copied ? copiedS : copyS}
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                onClick={handleDownloadText}
                disabled={!canBuildPrompt}
                startIcon={<Download />}
                sx={{ flexShrink: 0 }}
              >
                {downloadS}
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {pasteHintS}
            </Typography>
          </Box>
        )}

        <FieldPromptIaResultJson
          value={pasted}
          onChange={setPasted}
          disabled={busy}
        />

        {Boolean(pasted.trim()) && !parsed.ok && parsed.error && (
          <Alert severity="error">{parsed.error}</Alert>
        )}

        {parsed.ok && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {`${plural(parsed.lines.length, "ligne")} de coupe · ${plural(parsed.cotes.length, "cote")}`}
            </Typography>
            {preview && (
              <Typography
                variant="body2"
                color={preview.overCount ? "warning.main" : "success.main"}
              >
                {`${plural(preview.pieceCount, "pièce")} · surface max ${formatArea(preview.maxPieceArea)}` +
                  (preview.overCount
                    ? ` · ${preview.overCount} au-dessus de ${formatArea(maxArea)}`
                    : "")}
              </Typography>
            )}
            {preview?.offSurfaceCount > 0 && (
              <Typography variant="caption" color="warning.main">
                {`${plural(preview.offSurfaceCount, "point")} hors des surfaces de la scène`}
              </Typography>
            )}
            {parsed.note && (
              <Typography variant="caption" color="text.secondary">
                {parsed.note}
              </Typography>
            )}
            {warnings.slice(0, MAX_WARNINGS).map((warning) => (
              <Typography key={warning} variant="caption" color="warning.main">
                {warning}
              </Typography>
            ))}
            {warnings.length > MAX_WARNINGS && (
              <Typography variant="caption" color="warning.main">
                {`… et ${warnings.length - MAX_WARNINGS} autre(s) avertissement(s)`}
              </Typography>
            )}
          </Box>
        )}

        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
          <Button onClick={onClose} disabled={busy} color="inherit">
            {closeS}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!parsed.ok || busy}
            startIcon={
              busy ? <CircularProgress size={14} color="inherit" /> : null
            }
          >
            {createS}
          </Button>
        </Box>
      </Box>
    </DialogGeneric>
  );
}
