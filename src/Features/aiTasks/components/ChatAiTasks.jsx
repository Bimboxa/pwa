import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { v4 as uuidv4 } from "uuid";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { addMessage, setVectorization } from "Features/chat/chatSlice";
import {
  setNewAnnotation,
  triggerAnnotationTemplatesUpdate,
} from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Add, ArrowBack } from "@mui/icons-material";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useListings from "Features/listings/hooks/useListings";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import useAssistantRelayConfig from "Features/assistantRelay/hooks/useAssistantRelayConfig";
import {
  createVectorization,
  describeRelayError,
} from "Features/assistantRelay/services/assistantRelayClient";
import { saveVectorizationPointer } from "Features/assistantRelay/utils/vectorizationPointer";
import resolveAiTaskSource from "../services/resolveAiTaskSource";
import prepareAiTaskDestination from "../services/prepareAiTaskDestination";
import renderAiTaskExample from "../services/renderAiTaskExample";
import {
  requestAiTaskExample,
  cancelAiTaskExample,
} from "../services/aiTaskExampleCapture";
import {
  describeAiTaskSource,
  assertAiTaskTarget,
} from "../utils/aiTaskSource";
import {
  mappedTemplate,
  suggestAiTaskMappings,
  templateType,
  toAiTaskContract,
} from "../utils/aiTaskMappings";
import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";
import AiTaskMappingRow from "./AiTaskMappingRow";
import AiTaskWorkPanel from "./AiTaskWorkPanel";

export default function ChatAiTasks() {
  const appConfig = useAppConfig();
  const baseMap = useMainBaseMap();
  const templates = useAnnotationTemplates();
  const { value: listings = [] } = useListingsByScope({
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });
  const config = useAssistantRelayConfig();
  const dispatch = useDispatch();
  const chat = useSelector((s) => s.chat);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const { value: projectListings = [] } = useListings({
    filterByProjectId: projectId,
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const drawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const drawingDraft = useSelector((s) => s.annotations.newAnnotation);
  const [selection, setSelection] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [focusedRowId, setFocusedRowId] = useState(null);
  const focusedRow = rows.find((row) => row.id === focusedRowId);
  const [listingId, setListingId] = useState("");
  const [newListingName, setNewListingName] = useState("GO auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [drawing, setDrawing] = useState(null);
  const captureRef = useRef(null);
  const mounted = useRef(true);
  const submitting = useRef(false);
  const currentContext = useRef(null);
  currentContext.current = { projectId, scopeId, baseMap };
  // A launch frozen before its first network request is reused after an
  // uncertain response; editable UI drafts cannot alter that pending launch.
  const launchRef = useRef(null);
  const pdfByteSizeRef = useRef(null);
  const destinationRef = useRef(null);
  const [launchLocked, setLaunchLocked] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const tasks = (appConfig?.aiTasks ?? []).filter(
    (t) => t.execution === "pdfVectorization"
  );
  const available = (templates ?? []).filter((t) =>
    ["STRIP", "POLYLINE"].includes(templateType(t))
  );
  const scopeListings = listings ?? [];
  const contextChanged =
    selection &&
    (selection.projectId !== projectId ||
      selection.scopeId !== scopeId ||
      selection.baseMap?.id !== baseMap?.id);
  const disabled = busy || launchLocked || Boolean(drawing);
  const unavailable = busy || chat.isThinking || Boolean(chat.vectorization);

  function cancelDrawing() {
    const id = captureRef.current;
    if (!id) return;
    cancelAiTaskExample(id);
    captureRef.current = null;
    setDrawing(null);
    if (drawingDraft?.aiTaskExampleId === id) {
      dispatch(setEnabledDrawingMode(null));
      dispatch(setNewAnnotation({}));
    }
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (captureRef.current) {
        cancelAiTaskExample(captureRef.current);
        dispatch(setEnabledDrawingMode(null));
        dispatch(setNewAnnotation({}));
        captureRef.current = null;
      }
    };
  }, [dispatch]);
  useEffect(() => {
    if (
      drawing &&
      (drawingDraft?.aiTaskExampleId !== drawing.id ||
        !drawingMode ||
        contextChanged)
    )
      cancelDrawing();
  }, [drawingDraft?.aiTaskExampleId, drawingMode, contextChanged, drawing]);

  function openTask(task) {
    if (selection?.task.id === task.id && selection.source && !contextChanged) {
      setPanelOpen(true);
      return;
    }
    let source = null,
      sourceError = null;
    try {
      source = describeAiTaskSource(baseMap);
    } catch (e) {
      sourceError = e.message;
    }
    const destination = scopeListings.some((l) => l.id === selectedListingId)
      ? selectedListingId
      : (scopeListings[0]?.id ?? "new");
    const initial = (task.works ?? task.annotationTemplates ?? []).map((t) => ({
      ...t,
      detectionLabel: t.detectionLabel ?? t.label,
      description: t.description ?? "",
      templateId: "",
    }));
    setRows(suggestAiTaskMappings(initial, available, destination));
    setListingId(destination);
    setNewListingName(task.label);
    setError(null);
    setFocusedRowId(null);
    setSelection({
      task,
      baseMap,
      projectId,
      scopeId,
      source,
      sourceError,
      clientRequestId: uuidv4(),
      sessionId: chat.conversation.budgetSessionId,
      sessionName: chat.conversation.sessionName,
      level: chat.reasoningLevelId,
    });
    launchRef.current = null;
    destinationRef.current = null;
    setLaunchLocked(false);
    setPanelOpen(true);
  }
  function updateRow(id, patch) {
    setRows((previous) =>
      previous.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  }
  function changeListing(value) {
    setListingId(value);
    setRows((previous) =>
      suggestAiTaskMappings(previous, available, value).map((r, i) =>
        previous[i].templateId
          ? { ...r, templateId: previous[i].templateId }
          : r
      )
    );
  }
  function reorder({ active, over }) {
    if (disabled || !over || active.id === over.id) return;
    setRows((previous) =>
      arrayMove(
        previous,
        previous.findIndex((r) => r.id === active.id),
        previous.findIndex((r) => r.id === over.id)
      )
    );
  }
  function drawExample(row) {
    if (drawingMode) {
      setError(
        "Terminez ou annulez le dessin en cours avant de repérer un exemple."
      );
      return;
    }
    if (contextChanged || !selection.source) return;
    setError(null);
    const id = uuidv4();
    captureRef.current = id;
    setDrawing({ id, rowId: row.id });
    const template = mappedTemplate(row, available) ?? row;
    const color = template.strokeColor ?? template.fillColor ?? row.strokeColor;
    requestAiTaskExample(id, selection.baseMap.id, async (example, message) => {
      captureRef.current = null;
      if (!mounted.current) return;
      setDrawing(null);
      if (!example) {
        setError(message);
        return;
      }
      updateRow(row.id, { example, preview: null });
      try {
        const preview = await renderAiTaskExample(
          selection.baseMap,
          example,
          color
        );
        if (mounted.current)
          setRows((previous) =>
            previous.map((r) =>
              r.id === row.id && r.example === example ? { ...r, preview } : r
            )
          );
      } catch (e) {
        if (mounted.current) setError(e.message);
      }
    });
    const type = templateType(template) === "STRIP" ? "STRIP" : "POLYLINE";
    const draft = getNewAnnotationPropsFromAnnotationTemplate(template);
    // Examples are independent drafts: toolbar edits must not change the
    // template's remembered defaults or inherit locked thickness fields.
    delete draft.annotationTemplateId;
    dispatch(
      setNewAnnotation({
        ...draft,
        type,
        drawingShape: "POLYLINE",
        strokeColor: color,
        overrideFields: [],
        aiTaskExampleId: id,
      })
    );
    dispatch(
      setEnabledDrawingMode(type === "STRIP" ? "STRIP" : "POLYLINE_CLICK")
    );
  }
  let valid =
    rows.length > 0 &&
    !rows.some((row) => row.newModelDraft) &&
    Boolean(listingId) &&
    (listingId !== "new" || Boolean(newListingName.trim())) &&
    Boolean(scopeId);
  try {
    for (const row of rows) {
      const template = mappedTemplate(row, available);
      if (!template) valid = false;
      else toAiTaskContract(row, template);
    }
  } catch {
    valid = false;
  }

  async function execute() {
    if (
      submitting.current ||
      unavailable ||
      drawing ||
      contextChanged ||
      !valid
    )
      return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      assertAiTaskTarget(baseMap, {
        image: selection.baseMap.getImageSize(),
        aiTaskTarget: {
          frame: selection.source.frame,
          sourceImageSize: selection.source.sourceImageSize,
          transform: selection.source.transform,
        },
      });
      if (!launchRef.current) {
        // Resolve/upload PDF before creating any destination records.
        const source = await resolveAiTaskSource({
          ...selection,
          listingId: listingId === "new" ? null : listingId,
          config,
        });
        pdfByteSizeRef.current = source.pdfByteSize;
        const current = currentContext.current;
        if (
          current.projectId !== selection.projectId ||
          current.scopeId !== selection.scopeId ||
          current.baseMap?.id !== selection.baseMap?.id
        )
          throw new Error(
            "Le contexte a changé pendant la préparation. Revenez au fond d’origine."
          );
        assertAiTaskTarget(current.baseMap, {
          image: selection.baseMap.getImageSize(),
          aiTaskTarget: {
            frame: selection.source.frame,
            sourceImageSize: selection.source.sourceImageSize,
            transform: selection.source.transform,
          },
        });
        const destination = await prepareAiTaskDestination({
          requestId: selection.clientRequestId,
          listingId,
          newListingName,
          projectId,
          scopeId,
          rows,
          appConfig,
        });
        destinationRef.current = destination;
        dispatch(triggerAnnotationTemplatesUpdate());
        source.existingBaseMap.context.listingId = destination.listing.id;
        source.existingBaseMap.context.templates = destination.contracts.map(
          (t) => ({
            id: t.existingTemplateId,
            label: t.label,
            type: t.type,
            strokeColor: t.strokeColor,
          })
        );
        source.existingBaseMap.annotationTemplates = destination.contracts;
        launchRef.current = {
          pdfId: source.pdfId,
          pageNumber: source.pageNumber,
          name: selection.task.label,
          instruction: selection.task.prompt,
          target: {
            projectId,
            scopeId,
            existingBaseMap: source.existingBaseMap,
          },
          clientRequestId: selection.clientRequestId,
          ...(selection.sessionId ? { sessionId: selection.sessionId } : {}),
          ...(selection.sessionName
            ? { sessionName: selection.sessionName }
            : {}),
          ...(selection.level ? { level: selection.level } : {}),
        };
        setLaunchLocked(true);
      }
      const run = await createVectorization(launchRef.current);
      const messageId = uuidv4();
      dispatch(
        addMessage({
          id: uuidv4(),
          role: "user",
          content: `${selection.task.label} — ${selection.source.fileName}, page ${run.frame.pageNumber}\n${rows.map((r) => `${r.detectionLabel} → ${mappedTemplate(r, available)?.label ?? r.label}`).join(", ")}`,
        })
      );
      dispatch(
        addMessage({
          id: messageId,
          role: "assistant",
          type: "vectorization",
          pdfByteSize: pdfByteSizeRef.current,
          content: "",
          run,
          confirmed: true,
          baseMapId: selection.baseMap.id,
        })
      );
      const pointer = {
        runId: run.runId,
        messageId,
        target: run.target,
        pdfByteSize: pdfByteSizeRef.current,
      };
      saveVectorizationPointer(pointer);
      dispatch(setVectorization(pointer));
      setPanelOpen(false);
      setSelection(null);
      launchRef.current = null;
      setLaunchLocked(false);
    } catch (e) {
      // A definitive validation/auth rejection did not start a run. Keep the
      // already-created destination, but allow correcting descriptions/examples.
      // Network/timeout/server failures stay frozen for an idempotent retry.
      if (
        launchRef.current &&
        [400, 401, 403, 404, 413, 422].includes(e.status)
      ) {
        const destination = destinationRef.current;
        if (destination) {
          setListingId(destination.listing.id);
          setRows((previous) =>
            previous.map((row) => ({
              ...row,
              templateId:
                destination.contracts.find((t) => t.id === row.id)
                  ?.existingTemplateId ?? row.templateId,
            }))
          );
        }
        launchRef.current = null;
        setLaunchLocked(false);
        setSelection((previous) => ({
          ...previous,
          clientRequestId: uuidv4(),
        }));
      }
      const error = e?.code
        ? describeRelayError(e)
        : (e.message ?? "Impossible de lancer la tâche.");
      setError(error);
      if (e?.code === "EMPTY_PDF") {
        dispatch(
          addMessage({ id: uuidv4(), role: "assistant", content: "", error })
        );
        setPanelOpen(false);
        setSelection(null);
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  if (!tasks.length) return null;
  const destinationName =
    listingId === "new"
      ? newListingName
      : scopeListings.find((l) => l.id === listingId)?.name;
  return (
    <>
      <Stack
        direction="row"
        spacing={1}
        sx={{ px: 2, pb: 1, flexWrap: "wrap", gap: 1 }}
      >
        {tasks.map((task) => (
          <Button
            key={task.id}
            size="small"
            variant="outlined"
            color="inherit"
            disabled={unavailable}
            onClick={() => openTask(task)}
          >
            {selection?.task.id === task.id
              ? `Reprendre ${task.label}`
              : task.label}
          </Button>
        ))}
      </Stack>
      {panelOpen && selection && (
        <Box
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
            <Button
              size="small"
              color="inherit"
              startIcon={<ArrowBack />}
              disabled={busy}
              onClick={() => {
                cancelDrawing();
                if (focusedRow) setFocusedRowId(null);
                else setPanelOpen(false);
              }}
            >
              {focusedRow ? "Retour aux ouvrages" : "Retour à la discussion"}
            </Button>
            <Typography variant="h6" sx={{ mt: 1 }}>
              {focusedRow
                ? focusedRow.detectionLabel || "Nouvel ouvrage"
                : selection.task.label}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {focusedRow
                ? "Précisez les indices utiles au repérage de cet ouvrage."
                : selection.task.description}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 1.5 }}>
            {focusedRow ? (
              <>
                {drawing && (
                  <Alert
                    severity="info"
                    action={
                      <Button color="inherit" onClick={cancelDrawing}>
                        Annuler
                      </Button>
                    }
                    sx={{ mb: 1.5 }}
                  >
                    Dessinez un exemple sur le plan, puis validez avec Entrée.
                    Échap annule le dessin. L’exemple reste dans cette tâche.
                  </Alert>
                )}
                <AiTaskWorkPanel
                  row={focusedRow}
                  templates={available}
                  destinationName={destinationName}
                  disabled={disabled || Boolean(contextChanged)}
                  drawing={Boolean(drawing)}
                  onChange={(patch) => updateRow(focusedRow.id, patch)}
                  onExample={() => drawExample(focusedRow)}
                />
              </>
            ) : (
              <>
                <Typography variant="subtitle2">
                  Liste de destination
                </Typography>
                <TextField
                  select
                  fullWidth
                  size="small"
                  value={listingId}
                  disabled={disabled}
                  sx={{ mt: 1 }}
                  onChange={(e) => changeListing(e.target.value)}
                  inputProps={{ "aria-label": "Liste de destination" }}
                >
                  <MenuItem value="new">＋ Nouvelle liste</MenuItem>
                  {scopeListings.map((l) => (
                    <MenuItem key={l.id} value={l.id}>
                      {l.name}
                    </MenuItem>
                  ))}
                </TextField>
                {listingId === "new" && (
                  <TextField
                    fullWidth
                    size="small"
                    value={newListingName}
                    placeholder="Nom de la nouvelle liste"
                    disabled={disabled}
                    onChange={(e) => setNewListingName(e.target.value)}
                    inputProps={{
                      "aria-label": "Nom de la nouvelle liste",
                      maxLength: 200,
                    }}
                    sx={{ mt: 1 }}
                  />
                )}
                <Typography variant="body2" sx={{ my: 1.5 }}>
                  <strong>{destinationName || "Choisissez une liste"}</strong> ·{" "}
                  {rows.length} ouvrage{rows.length > 1 ? "s" : ""} à associer
                </Typography>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={reorder}
                >
                  <SortableContext
                    items={rows.map((r) => r.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <Stack spacing={0.75}>
                      {rows.map((row) => (
                        <AiTaskMappingRow
                          key={row.id}
                          row={row}
                          templates={available}
                          listings={projectListings ?? []}
                          destinationId={listingId}
                          disabled={disabled || Boolean(contextChanged)}
                          onChange={(patch) => updateRow(row.id, patch)}
                          onDelete={() =>
                            setRows((previous) =>
                              previous.filter((r) => r.id !== row.id)
                            )
                          }
                          onOpen={() => setFocusedRowId(row.id)}
                        />
                      ))}
                    </Stack>
                  </SortableContext>
                </DndContext>
                <Button
                  startIcon={<Add />}
                  disabled={disabled || rows.length >= 50}
                  sx={{ mt: 1 }}
                  onClick={() =>
                    setRows((previous) => [
                      ...previous,
                      {
                        id: uuidv4(),
                        detectionLabel: "",
                        description: "",
                        templateId: "",
                        label: "",
                        type: "POLYLINE",
                        strokeColor: "#42a5f5",
                      },
                    ])
                  }
                >
                  Ajouter un ouvrage
                </Button>
                <Typography variant="caption" color="text.secondary">
                  {selection.source?.fileName} · page{" "}
                  {selection.source?.frame.pageNumber} ·{" "}
                  {selection.baseMap?.name}
                </Typography>
              </>
            )}
            {(error || selection.sourceError || contextChanged) && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {contextChanged
                  ? "Revenez au fond et au repérage d’origine pour poursuivre cette tâche."
                  : error || selection.sourceError}
              </Alert>
            )}
            {launchLocked && (
              <Alert severity="info" sx={{ mt: 1 }}>
                La destination est préparée. Réessayer reprendra la même demande
                sans créer de doublons.
              </Alert>
            )}
          </Box>
          {!focusedRow && (
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              sx={{ p: 1.5, borderTop: "1px solid", borderColor: "divider" }}
            >
              <Typography variant="caption" color="text.secondary">
                {valid
                  ? "Correspondances prêtes"
                  : "Associez chaque ouvrage à un modèle"}
              </Typography>
              <Button
                variant="contained"
                disabled={
                  unavailable ||
                  Boolean(drawing) ||
                  Boolean(contextChanged) ||
                  Boolean(selection.sourceError) ||
                  !valid
                }
                onClick={execute}
                startIcon={
                  busy ? <CircularProgress size={16} color="inherit" /> : null
                }
              >
                {launchLocked ? "Réessayer" : "Exécuter"}
              </Button>
            </Stack>
          )}
        </Box>
      )}
    </>
  );
}
