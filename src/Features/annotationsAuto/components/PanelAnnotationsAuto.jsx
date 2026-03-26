import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedSourceListingId,
  setSelectedTargetListingId,
  setSelectedProcedureKey,
} from "../annotationsAutoSlice";

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
} from "@mui/material";
import { PlayArrow } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import DialogAnnotationsAutoConfirm from "./DialogAnnotationsAutoConfirm";

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

  const { value: listings } = useListingsByScope();

  const run = useAnnotationsAutoRun();

  // helpers

  const selectedProcedure = procedures.find(
    (p) => p.key === selectedProcedureKey
  );

  const targetListings = selectedProcedure?.targetListingKeys
    ? listings?.filter((l) =>
        selectedProcedure.targetListingKeys.includes(l.key)
      )
    : listings;

  const sourceListings = selectedProcedure?.sourceListingKeys
    ? listings?.filter((l) =>
        selectedProcedure.sourceListingKeys.includes(l.key)
      )
    : listings;

  const canRun =
    selectedSourceListingId && selectedTargetListingId && selectedProcedureKey;

  // handlers

  function handleProcedureChange(e) {
    const key = e.target.value;
    dispatch(setSelectedProcedureKey(key));

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
  }

  function handleSourceChange(e) {
    dispatch(setSelectedSourceListingId(e.target.value));
  }

  async function handleRun() {
    if (!canRun) return;
    await run({
      sourceListingId: selectedSourceListingId,
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
