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
import { Close, SouthOutlined } from "@mui/icons-material";

import { getDrawingToolByKey } from "Features/mapEditor/constants/drawingTools.jsx";
import SectionProcedureParams from "Features/annotationsAuto/components/SectionProcedureParams";
import hasProcedureParams from "Features/annotationsAuto/utils/hasProcedureParams";

import useSystemDefinition from "../hooks/useSystemDefinition";
import SectionObjectMedia from "./SectionObjectMedia";
import SystemTemplateCard from "./SystemTemplateCard";

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
// the procedure flow: the source annotation you draw, the procedure parameters
// (e.g. water height for cuvelage) and the annotations it generates, each
// editable via the restricted template card (label / fill / stroke only).
// "Dessiner" pre-creates all templates in the target listing (selected from the
// panel footer) and arms drawing of the source.
export default function DialogSystemConfig({
  open,
  object,
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
          alignItems: "center",
          gap: 1.5,
          px: 3,
          py: 2.5,
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: "bold", lineHeight: 1.2 }}>
            {object.label}
          </Typography>
          {object.labelVariant && (
            <Typography variant="body2" color="text.secondary">
              {object.labelVariant}
            </Typography>
          )}
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

              {/* procedure parameters (e.g. water height for cuvelage), edited
                  in the shared annotationsAuto slice read at launch time */}
              {hasProcedureParams(procedure) && (
                <Box
                  sx={{
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    borderRadius: 2,
                    bgcolor: "background.paper",
                    p: 1.5,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: "bold", mb: 1.5 }}
                  >
                    Paramètres de la procédure
                  </Typography>
                  <SectionProcedureParams procedure={procedure} dense />
                </Box>
              )}

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
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 2,
          px: 3,
          py: 2,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
          bgcolor: "background.default",
        }}
      >
        <Button
          variant="contained"
          startIcon={ActionIcon ? <ActionIcon /> : undefined}
          disabled={!canPlace || !mainDraft}
          onClick={handlePlace}
        >
          Dessiner
        </Button>
      </Box>
    </Dialog>
  );
}
