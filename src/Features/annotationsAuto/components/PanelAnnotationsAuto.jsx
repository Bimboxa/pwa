import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedSourceListingId,
  setSelectedTargetListingId,
  setSelectedProcedureKey,
  setHeight,
  setCheckedTemplateIds,
  setReturnTechnique,
} from "../annotationsAutoSlice";

import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import useAnnotationsAutoRun from "../hooks/useAnnotationsAutoRun";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";

import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Paper,
  FormGroup,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { PlayArrow } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import DialogAnnotationsAutoConfirm from "./DialogAnnotationsAutoConfirm";
import FieldTextV2 from "Features/form/components/FieldTextV2";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function PanelAnnotationsAuto() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];

  const selectedSourceListingId = useSelector(
    (s) => s.annotationsAuto.selectedSourceListingId
  );
  const selectedTargetListingId = useSelector(
    (s) => s.annotationsAuto.selectedTargetListingId
  );
  const selectedProcedureKey = useSelector(
    (s) => s.annotationsAuto.selectedProcedureKey
  );
  const height = useSelector((s) => s.annotationsAuto.height);
  const checkedTemplateIds = useSelector(
    (s) => s.annotationsAuto.checkedTemplateIds
  );
  const returnTechnique = useSelector(
    (s) => s.annotationsAuto.returnTechnique
  );

  const { value: listings } = useListingsByScope();
  const { value: locatedListings } = useListingsByScope({
    filterByEntityModelType: "LOCATED_ENTITY",
  });

  const run = useAnnotationsAutoRun();

  // helpers

  const selectedProcedure = procedures.find(
    (p) => p.key === selectedProcedureKey
  );

  const hideSourceListing = selectedProcedure?.hideSourceListing === true;
  const showHeightInput = selectedProcedure?.showHeightInput === true;
  const showTemplateCheckboxes =
    selectedProcedure?.showTemplateCheckboxes === true;

  const filterLocatedOnly = selectedProcedure?.filterLocatedEntityOnly === true;
  const baseTargetListings = filterLocatedOnly ? locatedListings : listings;
  const targetListings = selectedProcedure?.targetListingKeys
    ? baseTargetListings?.filter((l) =>
        selectedProcedure.targetListingKeys.includes(l.key)
      )
    : baseTargetListings;

  const sourceListings = selectedProcedure?.sourceListingKeys
    ? listings?.filter((l) =>
        selectedProcedure.sourceListingKeys.includes(l.key)
      )
    : listings;

  const targetTemplates = useAnnotationTemplates({
    filterByListingId:
      showTemplateCheckboxes && selectedTargetListingId
        ? selectedTargetListingId
        : undefined,
  });

  const canRun =
    selectedProcedureKey &&
    selectedTargetListingId &&
    (hideSourceListing || selectedSourceListingId);

  // handlers

  function handleProcedureChange(e) {
    const key = e.target.value;
    dispatch(setSelectedProcedureKey(key));
    dispatch(setHeight(null));
    dispatch(setCheckedTemplateIds(null));

    const proc = procedures.find((p) => p.key === key);
    if (!proc) return;

    // Auto-select first matching target if empty
    if (!selectedTargetListingId && proc.targetListingKeys) {
      const match = listings?.find((l) =>
        proc.targetListingKeys.includes(l.key)
      );
      if (match) dispatch(setSelectedTargetListingId(match.id));
    }

    // Auto-select first matching source if empty
    if (!selectedSourceListingId && proc.sourceListingKeys) {
      const match = listings?.find((l) =>
        proc.sourceListingKeys.includes(l.key)
      );
      if (match) dispatch(setSelectedSourceListingId(match.id));
    }
  }

  function handleTargetChange(e) {
    dispatch(setSelectedTargetListingId(e.target.value));
    dispatch(setCheckedTemplateIds(null));
  }

  function handleSourceChange(e) {
    dispatch(setSelectedSourceListingId(e.target.value));
  }

  function handleHeightChange(value) {
    dispatch(setHeight(value));
  }

  function handleTemplateToggle(templateId) {
    const allIds = targetTemplates?.map((t) => t.id) ?? [];
    const currentIds = checkedTemplateIds ?? allIds;
    const isChecked = currentIds.includes(templateId);
    const newIds = isChecked
      ? currentIds.filter((id) => id !== templateId)
      : [...currentIds, templateId];
    // if all are checked again, reset to null
    if (newIds.length === allIds.length && allIds.every((id) => newIds.includes(id))) {
      dispatch(setCheckedTemplateIds(null));
    } else {
      dispatch(setCheckedTemplateIds(newIds));
    }
  }

  async function handleRun() {
    if (!canRun) return;
    await run({
      sourceListingId: hideSourceListing ? null : selectedSourceListingId,
      targetListingId: selectedTargetListingId,
      procedureKey: selectedProcedureKey,
    });
  }

  // render

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

          <FormControl fullWidth size="small">
            <InputLabel>Liste cible</InputLabel>
            <Select
              value={selectedTargetListingId ?? ""}
              label="Liste cible"
              onChange={handleTargetChange}
            >
              {targetListings?.map((listing) => (
                <MenuItem key={listing.id} value={listing.id}>
                  {listing.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {showTemplateCheckboxes &&
            selectedTargetListingId &&
            targetTemplates?.length > 0 && (
              <FormGroup>
                {targetTemplates.map((template) => {
                  const isChecked = checkedTemplateIds
                    ? checkedTemplateIds.includes(template.id)
                    : true;
                  return (
                    <FormControlLabel
                      key={template.id}
                      control={
                        <Checkbox
                          checked={isChecked}
                          onChange={() => handleTemplateToggle(template.id)}
                          size="small"
                        />
                      }
                      label={
                        <Typography variant="body2">
                          {template.label}
                        </Typography>
                      }
                    />
                  );
                })}
              </FormGroup>
            )}

          {showTemplateCheckboxes && (
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

          {!hideSourceListing && (
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

          <Button
            variant="contained"
            color="inherit"
            startIcon={<PlayArrow />}
            onClick={handleRun}
            disabled={!canRun}
            sx={{
              bgcolor: "common.black",
              color: "common.white",
              "&:hover": { bgcolor: "grey.800" },
              borderRadius: 6,
            }}
          >
            Lancer la procédure
          </Button>
        </Paper>
      </Box>

      <DialogAnnotationsAutoConfirm />
    </BoxFlexVStretch>
  );
}
