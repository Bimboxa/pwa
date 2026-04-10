import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedSourceListingId,
  setSelectedProcedureKey,
  setHeight,
  setReturnTechnique,
  setRunning,
} from "../annotationsAutoSlice";

import { setToaster } from "Features/layout/layoutSlice";

import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import useAnnotationsAutoRun from "../hooks/useAnnotationsAutoRun";

import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Paper,
  FormControlLabel,
  Checkbox,
  CircularProgress,
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
  const selectedProcedureKey = useSelector(
    (s) => s.annotationsAuto.selectedProcedureKey
  );
  const height = useSelector((s) => s.annotationsAuto.height);
  const returnTechnique = useSelector(
    (s) => s.annotationsAuto.returnTechnique
  );
  const running = useSelector((s) => s.annotationsAuto.running);

  const { value: listings } = useListingsByScope();

  const run = useAnnotationsAutoRun();

  // helpers

  const selectedProcedure = procedures.find(
    (p) => p.key === selectedProcedureKey
  );

  const hideSourceListing = selectedProcedure?.hideSourceListing === true;
  const showHeightInput = selectedProcedure?.showHeightInput === true;
  const showReturnTechnique = selectedProcedure?.showReturnTechnique === true;

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
    selectedProcedureKey && (hideSourceListing || selectedSourceListingId);

  // handlers

  function handleProcedureChange(e) {
    const key = e.target.value;
    dispatch(setSelectedProcedureKey(key));
    dispatch(setHeight(null));

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

  const fireFlash = useCallback(() => {
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      background: "white",
      opacity: "0.6",
      zIndex: "9999",
      pointerEvents: "none",
      transition: "opacity 0.4s ease-out",
    });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.style.opacity = "0";
    });
    overlay.addEventListener("transitionend", () => overlay.remove());
  }, []);

  async function handleRun() {
    if (!canRun || running) return;
    dispatch(setRunning(true));
    try {
      const result = await run({
        sourceListingId: hideSourceListing ? null : selectedSourceListingId,
        procedureKey: selectedProcedureKey,
      });
      const count = result?.annotations?.length ?? 0;
      if (count > 0) {
        fireFlash();
        dispatch(
          setToaster({ message: `${count} annotation(s) créée(s)` })
        );
      } else {
        dispatch(
          setToaster({
            message:
              "Aucune annotation créée. Vérifiez les catégories des modèles.",
            severity: "warning",
          })
        );
      }
    } finally {
      dispatch(setRunning(false));
    }
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

          {selectedProcedure?.description && (
            <Box
              sx={{ bgcolor: "background.default", borderRadius: 1, p: 1.5 }}
            >
              <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
                {selectedProcedure.description}
              </Typography>
            </Box>
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

          <Button
            variant="contained"
            color="inherit"
            startIcon={
              running ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <PlayArrow />
              )
            }
            onClick={handleRun}
            disabled={!canRun || running}
            sx={{
              bgcolor: "common.black",
              color: "common.white",
              "&:hover": { bgcolor: "grey.800" },
              borderRadius: 6,
            }}
          >
            {running ? "En cours..." : "Lancer la procédure"}
          </Button>
        </Paper>
      </Box>

      <DialogAnnotationsAutoConfirm />
    </BoxFlexVStretch>
  );
}
