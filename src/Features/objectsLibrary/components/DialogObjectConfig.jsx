import { useEffect, useState } from "react";

import {
  Dialog,
  Box,
  Typography,
  IconButton,
  Button,
  Divider,
} from "@mui/material";
import { Close, Category } from "@mui/icons-material";

import getObjectActionButton from "../utils/getObjectActionButton";
import isObject3DEntry from "../utils/isObject3DEntry";
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

  // Reset the draft whenever a different object is opened. The label defaults to
  // the object's main name only ("Murs", not "Murs — Dessiner des bandes"): the
  // variant describes how the figure is drawn, not what the annotation is.
  useEffect(() => {
    if (object)
      setDraft({
        label: object.label ?? "",
        ...(object.template ?? {}),
      });
  }, [object?.id]);

  if (!object) return null;

  // 2D drawing figures (they declare a `tool`) show the tutorial media; 3D
  // objects show a large preview image instead. Both get the config panel and
  // the placement button.
  const isObject3D = isObject3DEntry(object);
  const isPlaceable = Boolean(object.tool) || isObject3D;
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
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {isObject3D ? (
            <Box
              sx={{
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
                    maxHeight: "60vh",
                    objectFit: "contain",
                    borderRadius: 2,
                  }}
                />
              ) : (
                <Category sx={{ fontSize: 120, color: "text.disabled" }} />
              )}
            </Box>
          ) : (
            <SectionObjectMedia object={object} />
          )}
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
        {isPlaceable ? (
          <Button
            variant="contained"
            startIcon={<ActionIcon />}
            disabled={!canPlace}
            onClick={handlePlace}
          >
            {isObject3D ? "Positionner" : "Dessiner"}
          </Button>
        ) : (
          <Button variant="contained" onClick={onClose}>
            Fermer
          </Button>
        )}
      </Box>
    </Dialog>
  );
}
