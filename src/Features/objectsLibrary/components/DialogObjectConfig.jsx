import { useEffect, useState } from "react";

import {
  Dialog,
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  Divider,
} from "@mui/material";
import { Close, Category } from "@mui/icons-material";

import { getTabLabel } from "../constants/objectsLibraryTabs";
import getObjectActionButton from "../utils/getObjectActionButton";
import SectionObjectMedia from "./SectionObjectMedia";
import FormObjectAnnotationConfig from "./FormObjectAnnotationConfig";

// Object detail dialog: tutorial media + description + the "Configurer
// l'annotation" panel. "Positionner" arms the placement mode with the edited
// config (disabled until a target listing is selected).
export default function DialogObjectConfig({
  open,
  object,
  canPlace,
  onClose,
  onPlace,
}) {
  const [draft, setDraft] = useState({});

  // Reset the draft whenever a different object is opened.
  useEffect(() => {
    if (object) setDraft({ label: "", ...(object.template ?? {}) });
  }, [object?.id]);

  if (!object) return null;

  // 2D drawing figures (they declare a `tool`) get the full media + config +
  // "Positionner" flow. Other objects (3D) just show a large image.
  const isPlaceable = Boolean(object.tool);
  const action = getObjectActionButton(object);
  const ActionIcon = action.Icon;

  function handlePlace() {
    onPlace({ object, userEdits: draft });
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      {/* header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          p: 2,
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            bgcolor: "primary.light",
            color: "primary.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Category />
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: "bold", lineHeight: 1.2 }}>
            {object.label}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
            <Chip
              size="small"
              color="primary"
              variant="outlined"
              label={getTabLabel(object.tab)}
            />
            {object.dimensionsLabel && (
              <Typography variant="body2" color="text.secondary">
                {object.dimensionsLabel}
              </Typography>
            )}
          </Box>
        </Box>
        <IconButton onClick={onClose}>
          <Close />
        </IconButton>
      </Box>

      {/* body */}
      {isPlaceable ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 3,
            p: 3,
          }}
        >
          <Box sx={{ flex: 1.4, minWidth: 0 }}>
            <SectionObjectMedia object={object} />
          </Box>
          <Divider
            orientation="vertical"
            flexItem
            sx={{ display: { xs: "none", md: "block" } }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <FormObjectAnnotationConfig
              object={object}
              draft={draft}
              onChange={setDraft}
            />
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            p: 3,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {object.thumbnailUrl ? (
            <Box
              component="img"
              src={object.thumbnailUrl}
              alt={object.label}
              sx={{
                maxWidth: "100%",
                maxHeight: "70vh",
                objectFit: "contain",
                borderRadius: 2,
              }}
            />
          ) : (
            <Category sx={{ fontSize: 120, color: "text.disabled" }} />
          )}
        </Box>
      )}

      {/* footer */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 2,
          p: 2,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        {isPlaceable ? (
          <>
            <Typography variant="caption" color="text.secondary">
              {canPlace
                ? "Cliquez sur le plan pour dessiner la figure."
                : "Sélectionnez une liste pour pouvoir dessiner."}
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button onClick={onClose}>Annuler</Button>
              <Button
                variant="contained"
                startIcon={<ActionIcon />}
                disabled={!canPlace}
                onClick={handlePlace}
              >
                Dessiner
              </Button>
            </Box>
          </>
        ) : (
          <>
            <span />
            <Button variant="contained" onClick={onClose}>
              Fermer
            </Button>
          </>
        )}
      </Box>
    </Dialog>
  );
}
