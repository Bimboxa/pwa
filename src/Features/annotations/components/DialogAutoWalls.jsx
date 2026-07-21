import { useEffect, useMemo, useState } from "react";

import { useSelector } from "react-redux";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Menu,
  Typography,
} from "@mui/material";

import useAnnotationTemplates from "../hooks/useAnnotationTemplates";
import useListings from "Features/listings/hooks/useListings";
import useApplyAutoWalls from "../hooks/useApplyAutoWalls";

import { resolveShapeCategory } from "../constants/drawingShapes.jsx";
import { resolveDrawingShape } from "../constants/drawingShapeConfig";

import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";

// normalize a mappingCategories entry ("OUVRAGE:VI" or {nomenclatureKey,
// categoryKey}) to the compact "NOMENCLATURE:CATEGORY" string
function toCategoryString(entry) {
  if (typeof entry === "string") return entry.trim();
  if (entry?.nomenclatureKey && entry?.categoryKey)
    return `${entry.nomenclatureKey}:${entry.categoryKey}`;
  return null;
}

export default function DialogAutoWalls({
  open,
  onClose,
  accentColor = "#1976d2",
}) {
  const applyAutoWalls = useApplyAutoWalls();

  // state

  const [annotationTemplateId, setAnnotationTemplateId] = useState(null);
  const [templateAnchorEl, setTemplateAnchorEl] = useState(null);
  const [generating, setGenerating] = useState(false);

  // data — polyline templates + their listings (for grouping)

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const allTemplates = useAnnotationTemplates({ sortByLabel: true });
  const { value: listings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });

  const templates = useMemo(
    () =>
      (allTemplates ?? []).filter(
        (t) => resolveShapeCategory(resolveDrawingShape(t)) === "polyline"
      ),
    [allTemplates]
  );

  // preselect: first OUVRAGE:VI template, else first polyline template
  useEffect(() => {
    if (!open || annotationTemplateId || !templates.length) return;
    const viTemplate = templates.find((t) =>
      (t.mappingCategories ?? []).map(toCategoryString).includes("OUVRAGE:VI")
    );
    setAnnotationTemplateId((viTemplate ?? templates[0]).id);
  }, [open, annotationTemplateId, templates]);

  const selectedTemplate = templates.find((t) => t.id === annotationTemplateId);

  // handlers

  async function handleGenerate() {
    if (!selectedTemplate || generating) return;
    setGenerating(true);
    try {
      await applyAutoWalls({
        annotationTemplateId,
        template: selectedTemplate,
      });
      onClose?.();
    } finally {
      setGenerating(false);
    }
  }

  // render

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Parois auto</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            Crée des parois verticales entre le contour sélectionné (réserves
            comprises) et les surfaces adjacentes (tolérance 1 cm).
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={(e) => setTemplateAnchorEl(e.currentTarget)}
            sx={{ justifyContent: "flex-start", textTransform: "none" }}
          >
            {selectedTemplate?.label ?? "Choisir un style de polyligne…"}
          </Button>
          <Menu
            open={Boolean(templateAnchorEl)}
            anchorEl={templateAnchorEl}
            onClose={() => setTemplateAnchorEl(null)}
            slotProps={{ paper: { sx: { maxHeight: 360, width: 320 } } }}
          >
            <SelectorAnnotationTemplateVariantDense
              selectedAnnotationTemplateId={annotationTemplateId}
              annotationTemplates={templates}
              listings={listings}
              onChange={(id) => {
                setAnnotationTemplateId(id);
                setTemplateAnchorEl(null);
              }}
            />
          </Menu>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={!selectedTemplate || generating}
          sx={{ bgcolor: accentColor }}
        >
          Générer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
