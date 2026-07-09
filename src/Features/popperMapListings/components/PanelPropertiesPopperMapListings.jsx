import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";
import { setVisibleAreaOnly } from "Features/smartDetect/smartDetectSlice";
import { setShowLayers } from "Features/popperMapListings/popperMapListingsSlice";

import {
  Box,
  Typography,
  IconButton,
  Switch,
  FormControlLabel,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { ArrowBack as Back, DeleteOutline } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldCheck from "Features/form/components/FieldCheck";
import SectionDuplicates from "Features/popperMapListings/components/SectionDuplicates";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useDeleteUnusedAnnotationTemplates from "Features/annotations/hooks/useDeleteUnusedAnnotationTemplates";

export default function PanelPropertiesPopperMapListings() {
  const dispatch = useDispatch();

  // data

  const { value: scope } = useSelectedScope();
  const visibleAreaOnly = useSelector((s) => s.smartDetect.visibleAreaOnly);
  const showLayers = useSelector((s) => s.popperMapListings.showLayers);
  const { computeUnused, deleteUnused } = useDeleteUnusedAnnotationTemplates();

  // state

  const [openConfirm, setOpenConfirm] = useState(false);
  const [candidates, setCandidates] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // helpers

  const scopeName = scope?.name ?? "-?-";
  const templateCount = candidates?.templateCount ?? 0;
  const listingCount = candidates?.listingCount ?? 0;
  const hasUnused = templateCount > 0 || listingCount > 0;

  // handlers

  async function handleOpenConfirm() {
    const result = await computeUnused();
    setCandidates(result);
    setOpenConfirm(true);
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      await deleteUnused(candidates);
    } finally {
      setDeleting(false);
      setOpenConfirm(false);
    }
  }

  // render

  if (!scope) return null;

  return (
    <BoxFlexVStretch>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 0.5,
          pl: 1,
        }}
      >
        <IconButton onClick={() => dispatch(clearSelection())}>
          <Back />
        </IconButton>
        <Box sx={{ ml: 1 }}>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Repérages
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {scopeName}
          </Typography>
        </Box>
      </Box>

      {/* Content */}
      <BoxFlexVStretch sx={{ overflowY: "auto", p: 1.5, gap: 1 }}>
        {/* Card: Auto-detection options */}
        <WhiteSectionGeneric>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              fontSize: "0.7rem",
              textTransform: "uppercase",
              color: "text.secondary",
              letterSpacing: 0.5,
              mb: 0.5,
              display: "block",
            }}
          >
            Détection auto
          </Typography>
          <FieldCheck
            value={visibleAreaOnly}
            onChange={(v) => dispatch(setVisibleAreaOnly(v))}
            label="Détection sur partie visible de l'image"
            options={{ type: "check", showAsInline: true }}
          />
        </WhiteSectionGeneric>

        {/* Card: Layers toggle */}
        <WhiteSectionGeneric>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              fontSize: "0.7rem",
              textTransform: "uppercase",
              color: "text.secondary",
              letterSpacing: 0.5,
              mb: 0.5,
              display: "block",
            }}
          >
            Calques
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={showLayers}
                onChange={(e) => dispatch(setShowLayers(e.target.checked))}
                size="small"
              />
            }
            label={
              <Typography variant="body2">
                Travailler avec des calques
              </Typography>
            }
            sx={{ ml: 0 }}
          />
        </WhiteSectionGeneric>

        {/* Card: Cleanup unused templates */}
        <WhiteSectionGeneric>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              fontSize: "0.7rem",
              textTransform: "uppercase",
              color: "text.secondary",
              letterSpacing: 0.5,
              mb: 1,
              display: "block",
            }}
          >
            Nettoyage
          </Typography>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            startIcon={<DeleteOutline />}
            onClick={handleOpenConfirm}
          >
            Supprimer les modèles non utilisés
          </Button>
        </WhiteSectionGeneric>

        {/* Card: Duplicate annotations detection */}
        <WhiteSectionGeneric>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              fontSize: "0.7rem",
              textTransform: "uppercase",
              color: "text.secondary",
              letterSpacing: 0.5,
              mb: 1,
              display: "block",
            }}
          >
            Doublons
          </Typography>
          <SectionDuplicates />
        </WhiteSectionGeneric>
      </BoxFlexVStretch>

      {/* Confirm delete dialog */}
      <Dialog open={openConfirm} onClose={() => setOpenConfirm(false)}>
        <DialogTitle>Supprimer les modèles non utilisés</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {hasUnused
              ? `${templateCount} modèle${templateCount > 1 ? "s" : ""} et ${listingCount} liste${listingCount > 1 ? "s" : ""} non utilisés seront supprimés.`
              : "Aucun modèle non utilisé dans ce scope."}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenConfirm(false)} variant="outlined">
            Annuler
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={!hasUnused || deleting}
            autoFocus
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </BoxFlexVStretch>
  );
}
