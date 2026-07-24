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
import useConvertAnnotationToWall from "../hooks/useConvertAnnotationToWall";
import useSelectedAnnotation from "../hooks/useSelectedAnnotation";

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
  const convertAnnotationToWall = useConvertAnnotationToWall();

  // data

  // "Convertir en paroie" only applies to a selected POLYLINE (it becomes the
  // wall in place); a POLYGON stays a surface and uses "Générer".
  const selectedAnnotation = useSelectedAnnotation();
  const canConvert = selectedAnnotation?.type === "POLYLINE";

  // state

  const [annotationTemplateId, setAnnotationTemplateId] = useState(null);
  const [templateAnchorEl, setTemplateAnchorEl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [converting, setConverting] = useState(false);

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

  async function handleConvert() {
    if (converting) return;
    setConverting(true);
    try {
      await convertAnnotationToWall();
      onClose?.();
    } finally {
      setConverting(false);
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
          {canConvert && (
            <Typography variant="caption" color="text.secondary">
              « Convertir en paroie » transforme la polyligne sélectionnée en
              paroi sur place (garde son style actuel, ignore le choix de style
              ci-dessus) ; elle peut être découpée en plusieurs tronçons.
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        {canConvert && (
          <Button
            variant="outlined"
            onClick={handleConvert}
            disabled={converting || generating}
            sx={{ color: accentColor, borderColor: accentColor }}
          >
            Convertir en paroie
          </Button>
        )}
        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={!selectedTemplate || generating || converting}
          sx={{ bgcolor: accentColor }}
        >
          Générer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
