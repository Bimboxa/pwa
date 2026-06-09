import { useMemo, useState } from "react";

import { useSelector } from "react-redux";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Menu,
  Paper,
  TextField,
  Typography,
} from "@mui/material";

import useAnnotationTemplates from "../hooks/useAnnotationTemplates";
import useListings from "Features/listings/hooks/useListings";
import useGenerateWallsFromSegments from "../hooks/useGenerateWallsFromSegments";
import useCloneAnnotationAndEntity from "Features/mapEditor/hooks/useCloneAnnotationAndEntity";

import { resolveShapeCategory } from "../constants/drawingShapes.jsx";
import { resolveDrawingShape } from "../constants/drawingShapeConfig";
import getAnnotationTemplateProps from "../utils/getAnnotationTemplateProps";

import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";
import IllustrationDuplicateSegments from "./IllustrationDuplicateSegments";
import IllustrationSlopeWallStraight from "./IllustrationSlopeWallStraight";
import IllustrationSlopeWallConstant from "./IllustrationSlopeWallConstant";
import IllustrationSlopeWallMax from "./IllustrationSlopeWallMax";

// Generation options offered when duplicating selected contour segments of a
// sloped POLYGON. The 3 wall profiles create "bouts de parois" (wall pieces);
// "COPY" keeps the plain-polyline duplicate behaviour.
const OPTIONS = [
  {
    key: "COPY",
    label: "Copie simple",
    Illustration: IllustrationDuplicateSegments,
  },
  {
    key: "STRAIGHT",
    label: "Mur droit",
    Illustration: IllustrationSlopeWallStraight,
  },
  {
    key: "CONSTANT",
    label: "Hauteur fixe avec max",
    Illustration: IllustrationSlopeWallConstant,
  },
  { key: "MAX", label: "Hauteur max", Illustration: IllustrationSlopeWallMax },
];

export default function DialogDuplicateContourSegments({
  open,
  onClose,
  annotation,
  part,
  accentColor = "#1976d2",
}) {
  const generateWallsFromSegments = useGenerateWallsFromSegments();
  const cloneAnnotationAndEntity = useCloneAnnotationAndEntity();

  // state

  const [profileType, setProfileType] = useState("STRAIGHT");
  const [height, setHeight] = useState("1");
  const [maxHeight, setMaxHeight] = useState("");
  const [annotationTemplateId, setAnnotationTemplateId] = useState(null);
  const [templateAnchorEl, setTemplateAnchorEl] = useState(null);
  const [generating, setGenerating] = useState(false);

  // data

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

  const selectedTemplate = templates?.find(
    (t) => t.id === annotationTemplateId
  );

  // The contiguous chains spanning the selection (one wall / polyline each).
  const chains = useMemo(() => {
    if (!part) return [];
    if (part.kind === "SEGMENTS") {
      return (part.chains || []).filter(
        (c) => Array.isArray(c?.pointRefs) && c.pointRefs.length >= 2
      );
    }
    if (Array.isArray(part.pointRefs) && part.pointRefs.length >= 2) {
      return [{ pointRefs: part.pointRefs, closesRing: false }];
    }
    return [];
  }, [part]);

  // helpers

  const heightNum = parseFloat(height);
  const maxHeightNum = parseFloat(maxHeight);
  const needsHeight = profileType === "STRAIGHT" || profileType === "CONSTANT";
  // Max height is always optional now: CONSTANT keeps its height all along the
  // slope without it, MAX derives the ceiling from the highest selected point.
  const showsMaxHeight = profileType === "CONSTANT" || profileType === "MAX";

  const heightsValid =
    !needsHeight || (Number.isFinite(heightNum) && heightNum > 0);

  const canGenerate =
    chains.length > 0 &&
    Boolean(annotationTemplateId) &&
    heightsValid &&
    !generating;

  // handlers

  async function handleGenerate() {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      if (profileType === "COPY") {
        const template = templates.find((t) => t.id === annotationTemplateId);
        const newAnnotation = {
          ...getAnnotationTemplateProps(template),
          annotationTemplateId: template?.id,
          label: template?.label,
          listingId: template?.listingId,
          type: "POLYLINE",
        };
        await cloneAnnotationAndEntity(annotation, { newAnnotation, part });
      } else {
        const config = {
          profileType,
          height: Number.isFinite(heightNum) ? heightNum : undefined,
          maxHeight: Number.isFinite(maxHeightNum) ? maxHeightNum : undefined,
          annotationTemplateId,
          template: templates.find((t) => t.id === annotationTemplateId),
        };
        await generateWallsFromSegments(annotation, chains, config);
      }
      onClose?.();
    } finally {
      setGenerating(false);
    }
  }

  // render

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Dupliquer les segments
        {chains.length > 1 ? ` (${chains.length} polylignes)` : ""}
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {/* option cards — 2×2 grid: flat options (copie / mur droit) on top,
              slope-following options (hauteur fixe / hauteur max) on the bottom */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 1,
            }}
          >
            {OPTIONS.map(({ key, label, Illustration }) => {
              const selected = profileType === key;
              return (
                <Paper
                  key={key}
                  variant="outlined"
                  onClick={() => setProfileType(key)}
                  sx={{
                    p: 1,
                    cursor: "pointer",
                    borderColor: selected ? accentColor : "divider",
                    borderWidth: selected ? 2 : 1,
                    bgcolor: selected ? accentColor + "14" : "transparent",
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "center" }}>
                    <Box sx={{ width: "100%", maxWidth: 190 }}>
                      <Illustration width="100%" />
                    </Box>
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      mt: 0.5,
                      textAlign: "center",
                      fontWeight: selected ? "bold" : "normal",
                    }}
                  >
                    {label}
                  </Typography>
                </Paper>
              );
            })}
          </Box>

          {/* heights */}
          {(needsHeight || showsMaxHeight) && (
            <Box sx={{ display: "flex", gap: 1 }}>
              {needsHeight && (
                <TextField
                  label={
                    profileType === "CONSTANT" ? "Hauteur constante" : "Hauteur"
                  }
                  type="number"
                  size="small"
                  fullWidth
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">m</InputAdornment>
                    ),
                  }}
                />
              )}
              {showsMaxHeight && (
                <TextField
                  label="Hauteur max (optionnel)"
                  type="number"
                  size="small"
                  fullWidth
                  value={maxHeight}
                  onChange={(e) => setMaxHeight(e.target.value)}
                  helperText={
                    profileType === "MAX"
                      ? "Par défaut : point le plus haut de la pente"
                      : "Par défaut : hauteur conservée sur toute la pente"
                  }
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">m</InputAdornment>
                    ),
                  }}
                />
              )}
            </Box>
          )}

          {/* polyline template */}
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
          disabled={!canGenerate}
        >
          {profileType === "COPY" ? "Dupliquer" : "Générer"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
