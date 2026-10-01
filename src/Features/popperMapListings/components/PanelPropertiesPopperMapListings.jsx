import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { clearSelection } from "Features/selection/selectionSlice";
import { setVisibleAreaOnly } from "Features/smartDetect/smartDetectSlice";

import { Box, Typography, IconButton, Button } from "@mui/material";
import { ArrowBack as Back, DeleteOutline } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldCheck from "Features/form/components/FieldCheck";
import SectionDuplicates from "Features/popperMapListings/components/SectionDuplicates";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import DialogDeleteUnusedAnnotationTemplates from "Features/annotations/components/DialogDeleteUnusedAnnotationTemplates";

export default function PanelPropertiesPopperMapListings() {
  const dispatch = useDispatch();

  // data

  const { value: scope } = useSelectedScope();
  const visibleAreaOnly = useSelector((s) => s.smartDetect.visibleAreaOnly);

  // state

  const [openConfirm, setOpenConfirm] = useState(false);

  // helpers

  const scopeName = scope?.name ?? "-?-";

  // handlers

  function handleOpenConfirm() {
    setOpenConfirm(true);
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
      <DialogDeleteUnusedAnnotationTemplates
        open={openConfirm}
        onClose={() => setOpenConfirm(false)}
      />
    </BoxFlexVStretch>
  );
}
