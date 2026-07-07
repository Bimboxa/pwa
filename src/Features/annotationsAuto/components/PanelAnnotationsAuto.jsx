import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import {
  setSelectedSourceListingId,
  setSelectedProcedureKey,
  setSelectedAnnotationTemplateId,
  setHeight,
  setWaterHeight,
  setReturnTechnique,
  setIgnoreInteriorWalls,
} from "../annotationsAutoSlice";

import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import useListings from "Features/listings/hooks/useListings";
import useAnnotationTemplatesByProject from "Features/annotations/hooks/useAnnotationTemplatesByProject";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import ButtonSelectorAnnotationTemplateVariantDense from "Features/annotations/components/ButtonSelectorAnnotationTemplateVariantDense";

import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  FormControlLabel,
  Checkbox,
} from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import DialogAnnotationsAutoConfirm from "./DialogAnnotationsAutoConfirm";
import PanelAnnotationsAutoSelection from "./PanelAnnotationsAutoSelection";
import RowProcedureLauncher from "./RowProcedureLauncher";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import FieldNumberWithUnit from "Features/form/components/FieldNumberWithUnit";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function PanelAnnotationsAuto() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];

  const selectedSourceListingId = useSelector(
    (s) => s.annotationsAuto.selectedSourceListingId
  );
  const selectedProcedureKey = useSelector(
    (s) => s.annotationsAuto.selectedProcedureKey
  );
  const selectedAnnotationTemplateId = useSelector(
    (s) => s.annotationsAuto.selectedAnnotationTemplateId
  );
  const height = useSelector((s) => s.annotationsAuto.height);
  const waterHeight = useSelector((s) => s.annotationsAuto.waterHeight);
  const returnTechnique = useSelector((s) => s.annotationsAuto.returnTechnique);
  const ignoreInteriorWalls = useSelector(
    (s) => s.annotationsAuto.ignoreInteriorWalls
  );
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  const selectedItems = useSelector((s) => s.selection.selectedItems);
  const hasSelection = (selectedItems ?? []).some(
    (i) => i.type === "NODE" && i.nodeId
  );

  const { value: listings } = useListingsByScope();
  const allAnnotationTemplates = useAnnotationTemplatesByProject();
  const baseMap = useMainBaseMap();
  const baseMapId = baseMap?.id;

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const { value: candidatesListings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });

  // helpers

  const selectedProcedure = procedures.find(
    (p) => p.key === selectedProcedureKey
  );

  // Source annotations of the selected procedure on the base map: annotations
  // whose template is linked to it (template.procedureKeys). They scope the
  // launcher band's reset / refresh (deletion matches autoCreatedFrom against
  // this set) and provide the untagged-output fallback tag.
  const linkedTemplateIds = (allAnnotationTemplates ?? [])
    .filter((t) => (t.procedureKeys ?? []).includes(selectedProcedureKey))
    .map((t) => t.id);
  const linkedTemplatesKey = linkedTemplateIds.join(",");

  const sourceAnnotationIds = useLiveQuery(async () => {
    if (!baseMapId || linkedTemplateIds.length === 0) return [];
    const templateIdSet = new Set(linkedTemplateIds);
    const anns = await db.annotations
      .where("baseMapId")
      .equals(baseMapId)
      .toArray();
    return anns
      .filter((a) => !a.deletedAt && templateIdSet.has(a.annotationTemplateId))
      .map((a) => a.id);
  }, [baseMapId, linkedTemplatesKey, annotationsUpdatedAt]);

  const hideSourceListing = selectedProcedure?.hideSourceListing === true;
  const showHeightInput = selectedProcedure?.showHeightInput === true;
  const showCuvelageHeight = selectedProcedure?.showCuvelageHeight === true;
  const showWaterHeight = selectedProcedure?.showWaterHeight === true;
  const showReturnTechnique = selectedProcedure?.showReturnTechnique === true;
  const showAnnotationTemplateSelect =
    selectedProcedure?.showAnnotationTemplateSelect === true;
  const annotationTemplateDrawingShape =
    selectedProcedure?.annotationTemplateDrawingShape ?? null;

  const filteredAnnotationTemplates = (allAnnotationTemplates ?? []).filter(
    (t) =>
      !annotationTemplateDrawingShape ||
      t.drawingShape === annotationTemplateDrawingShape
  );

  // Auto-select first procedure on mount
  useEffect(() => {
    if (!selectedProcedureKey && procedures.length > 0) {
      const firstProc = procedures[0];
      dispatch(setSelectedProcedureKey(firstProc.key));
      if (firstProc.sourceListingKeys) {
        const match = listings?.find((l) =>
          firstProc.sourceListingKeys.includes(l.key)
        );
        if (match) dispatch(setSelectedSourceListingId(match.id));
      }
    }
  }, [selectedProcedureKey, procedures, listings, dispatch]);

  const sourceListings = selectedProcedure?.sourceListingKeys
    ? listings?.filter((l) =>
        selectedProcedure.sourceListingKeys.includes(l.key)
      )
    : listings;

  const canRun =
    selectedProcedureKey &&
    (hideSourceListing || selectedSourceListingId) &&
    (!showAnnotationTemplateSelect || selectedAnnotationTemplateId);

  // handlers

  function handleProcedureChange(e) {
    const key = e.target.value;
    dispatch(setSelectedProcedureKey(key));
    dispatch(setHeight(null));
    dispatch(setWaterHeight(null));
    dispatch(setSelectedAnnotationTemplateId(null));

    const proc = procedures.find((p) => p.key === key);
    if (!proc) return;

    // Auto-select first matching source if empty
    if (!selectedSourceListingId && proc.sourceListingKeys) {
      const match = listings?.find((l) =>
        proc.sourceListingKeys.includes(l.key)
      );
      if (match) dispatch(setSelectedSourceListingId(match.id));
    }
  }

  function handleSourceChange(e) {
    dispatch(setSelectedSourceListingId(e.target.value));
  }

  function handleHeightChange(value) {
    dispatch(setHeight(value));
  }

  // render

  // When annotations are selected, show per-procedure sections targeting the
  // selection instead of the standard "Dessin auto" form.
  if (hasSelection) {
    return <PanelAnnotationsAutoSelection />;
  }

  return (
    <BoxFlexVStretch>
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 2 }}>
          Dessin auto
        </Typography>

        <Paper sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Procédure</InputLabel>
            <Select
              value={selectedProcedureKey ?? ""}
              label="Procédure"
              onChange={handleProcedureChange}
            >
              {procedures.map((proc) => (
                <MenuItem key={proc.key} value={proc.key}>
                  {proc.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedProcedure?.description && (
            <Box
              sx={{ bgcolor: "background.default", borderRadius: 1, p: 1.5 }}
            >
              <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
                {selectedProcedure.description}
              </Typography>
            </Box>
          )}

          {showAnnotationTemplateSelect && (
            <ButtonSelectorAnnotationTemplateVariantDense
              selectedTemplateId={selectedAnnotationTemplateId}
              onChange={(id) => dispatch(setSelectedAnnotationTemplateId(id))}
              annotationTemplates={filteredAnnotationTemplates}
              listings={candidatesListings}
              placeholder="Sélectionner un modèle"
              fullWidth
              bgcolor="background.default"
            />
          )}

          {showHeightInput && (
            <FieldTextV2
              value={height ?? ""}
              onChange={handleHeightChange}
              label="Hauteur (m)"
              options={{
                showAsSection: true,
                isNumber: true,
                changeOnBlur: true,
              }}
            />
          )}

          {showCuvelageHeight && (
            <FieldNumberWithUnit
              value={height}
              onChange={handleHeightChange}
              label="Hauteur cuvelage"
              unit="m"
              helperText="Hauteur exprimée par rapport au fond de plan"
            />
          )}

          {showWaterHeight && (
            <FieldNumberWithUnit
              value={waterHeight}
              onChange={(v) => dispatch(setWaterHeight(v))}
              label="Hauteur d'eau"
              unit="m"
              helperText="Altitude absolue (scène 3D). Vide = ignorée"
            />
          )}

          {showReturnTechnique && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={returnTechnique ?? true}
                  onChange={(e) =>
                    dispatch(setReturnTechnique(e.target.checked))
                  }
                  size="small"
                />
              }
              label={
                <Typography variant="body2">Retour technique 1m</Typography>
              }
            />
          )}

          {showReturnTechnique && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={ignoreInteriorWalls ?? false}
                  onChange={(e) =>
                    dispatch(setIgnoreInteriorWalls(e.target.checked))
                  }
                  size="small"
                />
              }
              label={
                <Typography variant="body2">
                  Ignorer les murs intérieurs
                </Typography>
              }
            />
          )}

          {!hideSourceListing && selectedProcedureKey && (
            <FormControl fullWidth size="small">
              <InputLabel>Liste source</InputLabel>
              <Select
                value={selectedSourceListingId ?? ""}
                label="Liste source"
                onChange={handleSourceChange}
              >
                {sourceListings?.map((listing) => (
                  <MenuItem key={listing.id} value={listing.id}>
                    {listing.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {selectedProcedure && (
            <RowProcedureLauncher
              procedure={selectedProcedure}
              baseMapId={baseMapId}
              sourceAnnotationIds={sourceAnnotationIds ?? []}
              sourceListingId={
                hideSourceListing ? null : selectedSourceListingId
              }
              standardRun
              disabled={!canRun}
              sx={{
                mx: -2,
                mb: -2,
                px: 2,
                py: 1,
                borderBottomLeftRadius: (theme) => theme.shape.borderRadius,
                borderBottomRightRadius: (theme) => theme.shape.borderRadius,
              }}
            />
          )}
        </Paper>
      </Box>

      <DialogAnnotationsAutoConfirm />
    </BoxFlexVStretch>
  );
}
