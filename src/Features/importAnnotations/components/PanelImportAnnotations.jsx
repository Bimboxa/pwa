import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { ContentCopy, Upload } from "@mui/icons-material";

import db from "App/db/db";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";

import parseImportAnnotationsJson from "../utils/parseImportAnnotationsJson";
import { isImportTemplateReusable } from "../services/resolveImportTemplatesService";
import importAnnotationsInlineJsonService from "../services/importAnnotationsInlineJsonService";
import importMeshService from "../services/importMeshService";
import ImportAnnotationsPreview from "./ImportAnnotationsPreview";
import ImportAnnotationsTemplateList from "./ImportAnnotationsTemplateList";

import meshImportPrompt from "../../../../docs/annotations/MESH_IMPORT_PROMPT.md?raw";

export default function PanelImportAnnotations() {
  const dispatch = useDispatch();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  // Same listing set as the MAP viewer's PopperMapListings: scoped
  // LOCATED_ENTITY listings.
  const { value: listings } = useListingsByScope({
    filterByEntityModelType: "LOCATED_ENTITY",
  });
  const mainBaseMap = useMainBaseMap();
  // Project-wide (no listing filter), like useAnnotationsV2 — used to show
  // which imported templates already exist before running the import.
  const annotationTemplates = useAnnotationTemplates();

  // state

  const [rawJson, setRawJson] = useState("");
  const [widthMeters, setWidthMeters] = useState("");
  const [targetListingId, setTargetListingId] = useState("");
  const [excludedTemplateIds, setExcludedTemplateIds] = useState([]);
  // per-entry results of the last mesh import (MESH kind only)
  const [meshResults, setMeshResults] = useState(null);
  const [promptCopied, setPromptCopied] = useState(false);
  // When on, normalized coords map straight onto the baseMap pixel space and
  // the annotations are placed automatically at that relative position (no
  // manual click) — right when the drawing was traced from this very plan.
  const [relativeToBaseMap, setRelativeToBaseMap] = useState(true);

  // helpers

  const parseResult = useMemo(
    () => parseImportAnnotationsJson(rawJson),
    [rawJson]
  );
  const data = parseResult.ok ? parseResult.data : null;
  const error = parseResult.error;
  const isMesh = data?.kind === "MESH";
  const isDump = data?.kind === "DUMP";

  // Templates of the payload already present in the project: the import links
  // to them instead of duplicating. Only the dump format carries real db ids.
  const reusedTemplateIds = useMemo(() => {
    if (!isDump || !data?.annotationTemplates) return null;
    const rowsById = new Map((annotationTemplates ?? []).map((t) => [t.id, t]));
    return new Set(
      data.annotationTemplates
        .filter((t) => isImportTemplateReusable(rowsById.get(t.id), projectId))
        .map((t) => t.id)
    );
  }, [isDump, data?.annotationTemplates, annotationTemplates, projectId]);

  const mbpxTarget = mainBaseMap?.getMeterByPx?.() ?? null;

  // Automatic placement of a dump that names its source base map:
  // - another base map → pinned to the top-left corner of the target, at real
  //   scale when both scales are known;
  // - the same base map, bare row(s) without `imageSize` → source pixels.
  // Otherwise (null) the manual options below apply.
  const sourceBaseMapId = isDump ? data.sourceBaseMapId : null;
  const isOtherBaseMap = Boolean(
    sourceBaseMapId && mainBaseMap?.id && sourceBaseMapId !== mainBaseMap.id
  );
  let placement = null;
  if (isOtherBaseMap) placement = "TOP_LEFT";
  else if (isDump && data.imageSizeSynthetic) placement = "SOURCE_PIXELS";

  // A bare row carries no scale: read it off the source base map when it is
  // still in the local db.
  const sourceBaseMapRow = useLiveQuery(
    async () =>
      isOtherBaseMap
        ? ((await db.baseMaps.get(sourceBaseMapId)) ?? null)
        : null,
    [isOtherBaseMap, sourceBaseMapId]
  );
  const mbpxSource = isOtherBaseMap
    ? (data.meterByPx ?? sourceBaseMapRow?.meterByPx ?? null)
    : null;
  const hasRealScale = mbpxSource > 0 && mbpxTarget > 0;
  const sourceBaseMapName =
    data?.sourceBaseMapName ?? sourceBaseMapRow?.name ?? null;
  const widthMetersNum = parseFloat(widthMeters);
  const hasScale = widthMetersNum > 0 && mbpxTarget > 0;

  // mesh: cells inherit the parent annotation's listing — no target needed
  const canImport = Boolean(
    data && mainBaseMap?.id && (isMesh || (projectId && targetListingId))
  );

  // effect - prefill the width field from the JSON when present

  useEffect(() => {
    const jsonWidth = data?.image?.widthMeters;
    if (jsonWidth > 0) setWidthMeters(String(jsonWidth));
  }, [data?.image?.widthMeters]);

  // effect - default the target listing to the currently displayed one (or the
  // first available), once listings are loaded

  useEffect(() => {
    if (targetListingId) return;
    // A dump names the listing it was copied from: land the annotations back
    // there so a copy → re-import round-trip is a no-op.
    const sourceListingId = data?.sourceListingId;
    if (sourceListingId && listings?.some((l) => l.id === sourceListingId)) {
      setTargetListingId(sourceListingId);
    } else if (
      selectedListingId &&
      listings?.some((l) => l.id === selectedListingId)
    ) {
      setTargetListingId(selectedListingId);
    } else if (listings?.length) {
      setTargetListingId(listings[0].id);
    }
  }, [listings, selectedListingId, targetListingId, data?.sourceListingId]);

  // effect - clear the previous mesh results when the input changes

  useEffect(() => {
    setMeshResults(null);
  }, [rawJson]);

  // handlers

  async function handleCopyPrompt() {
    await navigator.clipboard.writeText(meshImportPrompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  }

  function handleToggleTemplate(templateId) {
    setExcludedTemplateIds((prev) =>
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId]
    );
  }

  async function handleImport() {
    if (!canImport) return;

    if (isMesh) {
      try {
        const results = await importMeshService({
          meshes: data.meshes,
          baseMap: mainBaseMap,
          dispatch,
        });
        setMeshResults(results);
      } catch (err) {
        console.error("[importAnnotations] mesh import failed", err);
      }
      return;
    }

    try {
      await importAnnotationsInlineJsonService({
        data,
        projectId,
        listingId: targetListingId,
        mainBaseMap,
        // Automatic placement: the scale comes from the source base map, never
        // from the (hidden) width field.
        widthMeters: placement
          ? hasRealScale
            ? mbpxSource * data.image.width
            : null
          : widthMetersNum,
        excludedTemplateIds,
        relativeToBaseMap: placement ? false : relativeToBaseMap,
        placement,
        // Only the dump carries real db template ids (see the service).
        preserveIds: isDump,
        dispatch,
      });
    } catch (err) {
      console.error("[importAnnotations] import failed", err);
    }
  }

  // render

  return (
    <BoxFlexVStretch sx={{ flexDirection: "column" }}>
      <Box sx={{ p: 2, flex: 1, minHeight: 0, overflowY: "auto" }}>
        <Typography variant="h6" gutterBottom>
          Importer des annotations
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Collez le JSON : données d’une annotation ou d’une sélection copiées
          depuis la barre d’outils (bouton debug), JSON inline (taille image,
          templates, annotations), ou maillage d’annotations existantes (kind «
          MESH »).
        </Typography>

        <TextField
          label="JSON inline"
          multiline
          minRows={6}
          maxRows={14}
          fullWidth
          value={rawJson}
          onChange={(e) => setRawJson(e.target.value)}
          placeholder='{ "imageSize": { "width": 4725, "height": 2362 }, "meterByPx": 0.0127, "annotations": [...] }'
          error={Boolean(error)}
          sx={{
            mb: 2,
            "& textarea": { fontFamily: "monospace", fontSize: 12 },
          }}
        />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {data && isMesh && (
          <>
            <Alert severity="info" sx={{ mb: 2 }}>
              L’import remplace le maillage existant des annotations ciblées.
            </Alert>
            <Typography variant="caption" color="text.secondary">
              Maillages à créer
            </Typography>
            <List dense sx={{ mb: 1 }}>
              {data.meshes.map((mesh) => {
                const count =
                  mesh.mode === "POLYGON"
                    ? `${mesh.meshLines.length} ligne(s)`
                    : `${Object.keys(mesh.meshLinesBySegment).length} segment(s)`;
                return (
                  <ListItem key={mesh.annotationId} disableGutters>
                    <ListItemText
                      primary={`${mesh.mode} — ${count}`}
                      secondary={mesh.annotationId}
                      slotProps={{
                        primary: { variant: "body2" },
                        secondary: {
                          variant: "caption",
                          sx: { fontFamily: "monospace" },
                        },
                      }}
                    />
                  </ListItem>
                );
              })}
            </List>
            {meshResults?.map((r, i) => (
              <Alert
                key={`${r.annotationId}-${r.segIndex ?? "x"}-${i}`}
                severity={r.ok ? "success" : r.skipped ? "info" : "error"}
                sx={{ mb: 1 }}
              >
                {`${r.annotationId.slice(0, 8)}…${
                  r.segIndex != null ? ` (segment ${r.segIndex})` : ""
                } : ${r.ok ? `${r.cellsCount} maille(s) créée(s)` : r.error}`}
              </Alert>
            ))}
          </>
        )}

        {data && !isMesh && (
          <>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Liste cible</InputLabel>
              <Select
                value={targetListingId}
                label="Liste cible"
                onChange={(e) => setTargetListingId(e.target.value)}
              >
                {(listings ?? []).map((l) => (
                  <MenuItem key={l.id} value={l.id}>
                    {l.name ?? l.id}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {isDump && (
              <Alert severity="info" sx={{ mb: 2 }}>
                {`Données d’annotations copiées — ${data.annotations.length} annotation(s), ${data.annotationTemplates.length} template(s). Les points partagés (jonctions) restent soudés.`}
              </Alert>
            )}

            {data.skipped?.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {`${data.skipped.length} annotation(s) ignorée(s) : ${[
                  ...new Set(data.skipped.map((a) => a.type ?? "?")),
                ].join(", ")}.`}
              </Alert>
            )}

            {placement === "SOURCE_PIXELS" && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Les annotations sont replacées à leur position d’origine (en
                pixels du fond de plan source).
              </Alert>
            )}
            {placement === "TOP_LEFT" && (
              <Alert
                severity={hasRealScale ? "info" : "warning"}
                sx={{ mb: 2 }}
              >
                {`Annotations issues d’un autre fond de plan${
                  sourceBaseMapName ? ` (« ${sourceBaseMapName} »)` : ""
                } : collées en partant du coin haut-gauche, ${
                  hasRealScale
                    ? "à l’échelle réelle."
                    : "sans échelle réelle (échelle source ou cible inconnue)."
                }`}
              </Alert>
            )}

            {!placement && (
              <FormControlLabel
                sx={{ mb: 1, display: "flex" }}
                control={
                  <Checkbox
                    checked={relativeToBaseMap}
                    onChange={(e) => setRelativeToBaseMap(e.target.checked)}
                  />
                }
                label="Positionner par rapport au fond de plan"
              />
            )}
            {!placement && relativeToBaseMap && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 2 }}
              >
                Les annotations sont calées sur les dimensions du fond de plan
                et placées automatiquement à leur position relative.
              </Typography>
            )}

            {!placement && !relativeToBaseMap && (
              <>
                <TextField
                  label="Largeur de l'image (m)"
                  type="number"
                  size="small"
                  fullWidth
                  value={widthMeters}
                  onChange={(e) => setWidthMeters(e.target.value)}
                  sx={{ mb: 2 }}
                />

                {!hasScale && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    {mbpxTarget > 0
                      ? "Renseignez la largeur de l'image (m) pour conserver l'échelle réelle."
                      : "Le baseMap cible n'est pas calibré : les annotations seront importées sans échelle réelle."}
                  </Alert>
                )}
              </>
            )}

            <Typography variant="caption" color="text.secondary">
              Aperçu
            </Typography>
            <Box sx={{ mb: 2, mt: 0.5 }}>
              <ImportAnnotationsPreview
                data={data}
                widthMeters={
                  placement
                    ? mbpxSource > 0
                      ? mbpxSource * data.image.width
                      : undefined
                    : widthMetersNum
                }
                excludedTemplateIds={excludedTemplateIds}
              />
            </Box>

            <ImportAnnotationsTemplateList
              templates={data.annotationTemplates}
              excludedTemplateIds={excludedTemplateIds}
              reusedIds={reusedTemplateIds}
              onToggle={handleToggleTemplate}
            />
          </>
        )}
      </Box>

      <Box sx={{ p: 2, borderTop: (t) => `1px solid ${t.palette.divider}` }}>
        <Button
          variant="outlined"
          fullWidth
          size="small"
          startIcon={<ContentCopy />}
          onClick={handleCopyPrompt}
          sx={{ mb: 1 }}
        >
          {promptCopied ? "Prompt copié !" : "Copier le prompt maillage IA"}
        </Button>
        <Button
          variant="contained"
          fullWidth
          startIcon={<Upload />}
          disabled={!canImport}
          onClick={handleImport}
        >
          {isMesh ? "Créer le maillage" : "Ajouter au fond de plan"}
        </Button>
      </Box>
    </BoxFlexVStretch>
  );
}
