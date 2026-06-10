import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setPasteClipboard } from "Features/mapEditor/mapEditorSlice";
import {
  triggerAnnotationTemplatesUpdate,
  triggerAnnotationsUpdate,
} from "Features/annotations/annotationsSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";

import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { Upload } from "@mui/icons-material";

import db from "App/db/db";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import pasteAnnotationService from "Features/mapEditor/services/pasteAnnotationService";

import parseImportAnnotationsJson from "../utils/parseImportAnnotationsJson";
import buildImportData from "../utils/buildImportData";
import ImportAnnotationsPreview from "./ImportAnnotationsPreview";
import ImportAnnotationsTemplateList from "./ImportAnnotationsTemplateList";

export default function PanelImportAnnotations() {
  const dispatch = useDispatch();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  // Same listing set as the MAP viewer's PopperMapListings: scoped
  // LOCATED_ENTITY listings, excluding the "isForBaseMaps" ones.
  const { value: listings } = useListingsByScope({
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });
  const mainBaseMap = useMainBaseMap();

  // state

  const [rawJson, setRawJson] = useState("");
  const [widthMeters, setWidthMeters] = useState("");
  const [targetListingId, setTargetListingId] = useState("");
  const [excludedTemplateIds, setExcludedTemplateIds] = useState([]);
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

  const mbpxTarget = mainBaseMap?.getMeterByPx?.() ?? null;
  const widthMetersNum = parseFloat(widthMeters);
  const hasScale = widthMetersNum > 0 && mbpxTarget > 0;

  const canImport = Boolean(
    data && projectId && mainBaseMap?.id && targetListingId
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
    if (
      selectedListingId &&
      listings?.some((l) => l.id === selectedListingId)
    ) {
      setTargetListingId(selectedListingId);
    } else if (listings?.length) {
      setTargetListingId(listings[0].id);
    }
  }, [listings, selectedListingId, targetListingId]);

  // handlers

  function handleToggleTemplate(templateId) {
    setExcludedTemplateIds((prev) =>
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId]
    );
  }

  async function handleImport() {
    if (!canImport) return;
    try {
      const { templateRecords, clipboard, relative } = buildImportData({
        data,
        widthMeters: widthMetersNum,
        mainBaseMap,
        projectId,
        listingId: targetListingId,
        excludedTemplateIds,
        relativeToBaseMap,
      });
      if (!clipboard.items.length) return;

      if (templateRecords.length) {
        await db.annotationTemplates.bulkAdd(templateRecords);
        dispatch(triggerAnnotationTemplatesUpdate());
      }

      // Switch the view to the target listing so the placed annotations
      // (filtered by listingId) become visible.
      dispatch(setSelectedListingId(targetListingId));

      if (relative) {
        // Position is fixed by the baseMap: place the group directly at its
        // own (source) center with an identity transform — no manual click.
        await pasteAnnotationService({
          pasteClipboard: clipboard,
          pasteTransform: { rotationDeg: 0, flipX: false },
          targetCenter: clipboard.sourceCenter,
          baseMap: mainBaseMap,
          dispatch,
          triggerAnnotationsUpdate,
        });
      } else {
        // Enter single-shot paste mode: the next click on the map positions
        // the group and exits.
        dispatch(setPasteClipboard({ ...clipboard, once: true }));
      }
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
          Collez le JSON inline (taille image, templates, annotations).
        </Typography>

        <TextField
          label="JSON inline"
          multiline
          minRows={6}
          maxRows={14}
          fullWidth
          value={rawJson}
          onChange={(e) => setRawJson(e.target.value)}
          placeholder='{ "image": { "width": 2000, "height": 1500 }, "annotationTemplates": [...], "annotations": [...] }'
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

        {data && (
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
            {relativeToBaseMap && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 2 }}
              >
                Les annotations sont calées sur les dimensions du fond de plan
                et placées automatiquement à leur position relative.
              </Typography>
            )}

            {!relativeToBaseMap && (
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
                widthMeters={widthMetersNum}
                excludedTemplateIds={excludedTemplateIds}
              />
            </Box>

            <ImportAnnotationsTemplateList
              templates={data.annotationTemplates}
              excludedTemplateIds={excludedTemplateIds}
              onToggle={handleToggleTemplate}
            />
          </>
        )}
      </Box>

      <Box sx={{ p: 2, borderTop: (t) => `1px solid ${t.palette.divider}` }}>
        <Button
          variant="contained"
          fullWidth
          startIcon={<Upload />}
          disabled={!canImport}
          onClick={handleImport}
        >
          Ajouter au fond de plan
        </Button>
      </Box>
    </BoxFlexVStretch>
  );
}
