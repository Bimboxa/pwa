import { useEffect, useState } from "react";

import {
  Dialog,
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  Divider,
  CircularProgress,
} from "@mui/material";
import { Close, AccountTreeOutlined, SouthOutlined } from "@mui/icons-material";

import { getDrawingToolByKey } from "Features/mapEditor/constants/drawingTools.jsx";

import useSystemDefinition from "../hooks/useSystemDefinition";
import SectionObjectMedia from "./SectionObjectMedia";
import SystemTemplateCard from "./SystemTemplateCard";
import SelectorListingForObjects from "./SelectorListingForObjects";

// A numbered step marker ("① Vous dessinez", "② Le système génère…").
function StepLabel({ index, color, label, count }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <Box
        sx={{
          width: 22,
          height: 22,
          flex: "none",
          borderRadius: "50%",
          bgcolor: color,
          color: "#fff",
          fontSize: 12,
          fontWeight: "bold",
          display: "grid",
          placeItems: "center",
        }}
      >
        {index}
      </Box>
      <Typography
        variant="overline"
        sx={{ fontWeight: "bold", lineHeight: 1.2 }}
      >
        {label}
      </Typography>
      {count != null && <Chip size="small" label={count} sx={{ height: 20 }} />}
    </Box>
  );
}

// Système dialog: shown when clicking a "Systèmes" library vignette. Mirrors
// DialogObjectConfig's shell (header / 2-col body / footer) but the body presents
// the procedure flow: the source annotation you draw + the annotations it
// generates, each editable via the shared template properties editor. "Dessiner"
// pre-creates all templates in the target listing and arms drawing of the source.
export default function DialogSystemConfig({
  open,
  object,
  targetListingId,
  onTargetListingChange,
  canPlace,
  onClose,
  onPlace,
}) {
  // data

  const { procedure, mainTemplate, generatedTemplates, loading } =
    useSystemDefinition(object);

  // state

  // Editable drafts, seeded from the resolved templates once they finish loading.
  const [mainDraft, setMainDraft] = useState(null);
  const [generatedDrafts, setGeneratedDrafts] = useState([]);

  useEffect(() => {
    if (!object || loading) return;
    setMainDraft(mainTemplate ? { ...mainTemplate } : null);
    setGeneratedDrafts(generatedTemplates.map((t) => ({ ...t })));
    // Re-seed only when a different système opens or the load completes; not on
    // every render (mainTemplate/generatedTemplates are recomputed each time).
  }, [object?.id, loading]);

  if (!object) return null;

  // helpers

  const description = procedure?.description ?? object.description;
  const count = generatedDrafts.length;
  const ActionIcon = mainDraft?.defaultTool
    ? (getDrawingToolByKey(mainDraft.defaultTool)?.Icon ?? null)
    : null;

  // handlers

  function handleGeneratedChange(index, next) {
    setGeneratedDrafts((prev) => prev.map((t, i) => (i === index ? next : t)));
  }

  function handlePlace() {
    onPlace({ object, mainDraft, generatedDrafts });
  }

  // render

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      {/* header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: 1.5,
          p: 2,
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            flex: "none",
            borderRadius: 2,
            bgcolor: "secondary.light",
            color: "secondary.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AccountTreeOutlined />
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexWrap: "wrap",
            }}
          >
            <Typography
              variant="h6"
              sx={{ fontWeight: "bold", lineHeight: 1.2 }}
            >
              {object.label}
            </Typography>
            <Chip size="small" color="secondary" label="Système" />
            <Chip
              size="small"
              color="secondary"
              variant="outlined"
              label="Procédure automatisée"
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Vous dessinez 1 annotation de départ — le système en génère {count}{" "}
            autre{count > 1 ? "s" : ""} automatiquement.
          </Typography>
        </Box>
        <IconButton onClick={onClose}>
          <Close />
        </IconButton>
      </Box>

      {/* body */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: 3,
          p: 3,
        }}
      >
        <Box sx={{ flex: 1.2, minWidth: 0 }}>
          <SectionObjectMedia object={{ ...object, description }} />
        </Box>
        <Divider
          orientation="vertical"
          flexItem
          sx={{ display: { xs: "none", md: "block" } }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {/* step 1 — the source annotation the user draws */}
              <StepLabel index={1} color="primary.main" label="Vous dessinez" />
              {mainDraft ? (
                <SystemTemplateCard
                  template={mainDraft}
                  onChange={setMainDraft}
                  variant="source"
                  defaultExpanded
                />
              ) : (
                <Typography variant="body2" color="error">
                  Template de départ introuvable pour cette procédure.
                </Typography>
              )}

              {/* connector */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  pl: 1,
                  color: "secondary.main",
                }}
              >
                <SouthOutlined fontSize="small" />
                <Typography variant="caption" sx={{ fontWeight: 500 }}>
                  {"La procédure s'exécute"}
                </Typography>
              </Box>

              {/* step 2 — the annotations the procedure generates */}
              <StepLabel
                index={2}
                color="secondary.main"
                label="Le système génère automatiquement"
                count={count}
              />
              {generatedDrafts.map((template, index) => (
                <SystemTemplateCard
                  key={template.id ?? template.mappingCategories?.[0] ?? index}
                  template={template}
                  onChange={(next) => handleGeneratedChange(index, next)}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {/* footer */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
          p: 2,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          bgcolor: "background.default",
        }}
      >
        <Box sx={{ minWidth: 240 }}>
          <SelectorListingForObjects
            value={targetListingId}
            onChange={onTargetListingChange}
          />
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ flex: 1, minWidth: 180 }}
        >
          {canPlace
            ? "Dessinez le polygone de départ : les annotations seront créées puis ajoutées à la liste cible."
            : "Sélectionnez une liste pour pouvoir dessiner."}
        </Typography>
        <Box sx={{ display: "flex", gap: 1, flex: "none" }}>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="contained"
            startIcon={ActionIcon ? <ActionIcon /> : undefined}
            disabled={!canPlace || !mainDraft}
            onClick={handlePlace}
          >
            Dessiner
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
