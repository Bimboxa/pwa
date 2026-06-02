import { useMemo, useState } from "react";

import { useSelector } from "react-redux";

import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  InputAdornment,
  Menu,
  Paper,
  TextField,
  Typography,
} from "@mui/material";

import useAnnotationTemplates from "../hooks/useAnnotationTemplates";
import useListings from "Features/listings/hooks/useListings";
import useGenerateSlopeWalls from "../hooks/useGenerateSlopeWalls";

import { resolveShapeCategory } from "../constants/drawingShapes.jsx";
import { resolveDrawingShape } from "../constants/drawingShapeConfig";

import SelectorAnnotationTemplateVariantDense from "./SelectorAnnotationTemplateVariantDense";
import IllustrationSlopeWallConstant from "./IllustrationSlopeWallConstant";
import IllustrationSlopeWallMax from "./IllustrationSlopeWallMax";

const PROFILES = [
  {
    key: "CONSTANT",
    label: "Hauteur constante avec limite",
    Illustration: IllustrationSlopeWallConstant,
  },
  { key: "MAX", label: "Hauteur max", Illustration: IllustrationSlopeWallMax },
];

function defaultSideState() {
  return {
    enabled: true,
    profileType: "CONSTANT",
    constantHeight: "1",
    maxHeight: "",
    annotationTemplateId: null,
  };
}

// ─── one side section (left or right) ──────────────────────────────────────

function SideSection({
  title,
  state,
  setState,
  accentColor,
  templates,
  listings,
}) {
  const [templateAnchorEl, setTemplateAnchorEl] = useState(null);

  const selectedTemplate = templates?.find(
    (t) => t.id === state.annotationTemplateId
  );

  function patch(updates) {
    setState((s) => ({ ...s, ...updates }));
  }

  return (
    <Box sx={{ flex: 1 }}>
      <FormControlLabel
        control={
          <Checkbox
            checked={state.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
          />
        }
        label={<Typography sx={{ fontWeight: "bold" }}>{title}</Typography>}
      />

      <Box
        sx={{
          opacity: state.enabled ? 1 : 0.4,
          pointerEvents: state.enabled ? "auto" : "none",
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          mt: 1,
        }}
      >
        {/* profile type — SVG cards */}
        <Box sx={{ display: "flex", gap: 1 }}>
          {PROFILES.map(({ key, label, Illustration }) => {
            const selected = state.profileType === key;
            return (
              <Paper
                key={key}
                variant="outlined"
                onClick={() => patch({ profileType: key })}
                sx={{
                  flex: 1,
                  p: 1,
                  cursor: "pointer",
                  borderColor: selected ? accentColor : "divider",
                  borderWidth: selected ? 2 : 1,
                  bgcolor: selected ? accentColor + "14" : "transparent",
                }}
              >
                <Illustration />
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
        <Box sx={{ display: "flex", gap: 1 }}>
          {state.profileType === "CONSTANT" && (
            <TextField
              label="Hauteur constante"
              type="number"
              size="small"
              fullWidth
              value={state.constantHeight}
              onChange={(e) => patch({ constantHeight: e.target.value })}
              InputProps={{
                endAdornment: <InputAdornment position="end">m</InputAdornment>,
              }}
            />
          )}
          <TextField
            label="Hauteur max"
            type="number"
            size="small"
            fullWidth
            value={state.maxHeight}
            onChange={(e) => patch({ maxHeight: e.target.value })}
            InputProps={{
              endAdornment: <InputAdornment position="end">m</InputAdornment>,
            }}
          />
        </Box>

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
            selectedAnnotationTemplateId={state.annotationTemplateId}
            annotationTemplates={templates}
            listings={listings}
            onChange={(id) => {
              patch({ annotationTemplateId: id });
              setTemplateAnchorEl(null);
            }}
          />
        </Menu>
      </Box>
    </Box>
  );
}

// ─── dialog ─────────────────────────────────────────────────────────────────

export default function DialogGenerateSlopeWalls({
  open,
  onClose,
  annotation,
  accentColor = "#1976d2",
}) {
  const generateSlopeWalls = useGenerateSlopeWalls();

  const [leftState, setLeftState] = useState(defaultSideState);
  const [rightState, setRightState] = useState(defaultSideState);
  const [generating, setGenerating] = useState(false);

  // polyline templates + their listings (for grouping)
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

  function buildSideConfig(side, state) {
    if (!state.enabled) return null;
    const maxHeight = parseFloat(state.maxHeight);
    const constantHeight = parseFloat(state.constantHeight);
    if (!Number.isFinite(maxHeight) || maxHeight <= 0) return null;
    if (!state.annotationTemplateId) return null;
    return {
      side,
      profileType: state.profileType,
      maxHeight,
      constantHeight: Number.isFinite(constantHeight) ? constantHeight : 1,
      annotationTemplateId: state.annotationTemplateId,
      template: templates.find((t) => t.id === state.annotationTemplateId),
    };
  }

  const sides = [
    buildSideConfig("LEFT", leftState),
    buildSideConfig("RIGHT", rightState),
  ].filter(Boolean);

  const canGenerate = sides.length > 0 && !generating;

  async function handleGenerate() {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      await generateSlopeWalls(annotation, sides);
      onClose?.();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Parois de la pente</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "flex", gap: 2 }}>
          <SideSection
            title="Paroi gauche"
            state={leftState}
            setState={setLeftState}
            accentColor={accentColor}
            templates={templates}
            listings={listings}
          />
          <Divider orientation="vertical" flexItem />
          <SideSection
            title="Paroi droite"
            state={rightState}
            setState={setRightState}
            accentColor={accentColor}
            templates={templates}
            listings={listings}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={!canGenerate}
        >
          Générer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
