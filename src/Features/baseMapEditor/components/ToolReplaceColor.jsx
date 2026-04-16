import { useState, useEffect } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setColorToReplace, clearColorToReplace } from "Features/opencv/opencvSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import {
  Box,
  Typography,
  ListItemButton,
  IconButton,
  CircularProgress,
} from "@mui/material";
import { Colorize } from "@mui/icons-material";

import replaceColorInImage from "Features/images/utils/replaceColorInImage";

export default function ToolReplaceColor({ baseMap, onResult }) {
  const dispatch = useDispatch();

  // data

  const colorToReplace = useSelector((state) => state.opencv.colorToReplace);
  const enabledDrawingMode = useSelector(
    (state) => state.mapEditor.enabledDrawingMode
  );

  // state

  const [loading, setLoading] = useState(null);

  // helpers

  const isPicking = enabledDrawingMode === "COLOR_PICKER";
  const hasColor = Boolean(colorToReplace);
  const versionUrl = baseMap?.getUrl();

  // cleanup on unmount

  useEffect(() => {
    return () => {
      dispatch(clearColorToReplace());
    };
  }, [dispatch]);

  // handlers

  function handlePickColor() {
    if (isPicking) {
      dispatch(setEnabledDrawingMode(null));
    } else {
      dispatch(setEnabledDrawingMode("COLOR_PICKER"));
    }
  }

  async function handleReplace(targetColorHex, label) {
    if (!versionUrl || !colorToReplace) return;
    setLoading(label);
    try {
      const file = await replaceColorInImage(
        versionUrl,
        colorToReplace,
        targetColorHex
      );
      if (file && onResult) {
        onResult(file, label);
      }
    } finally {
      setLoading(null);
    }
  }

  // render

  return (
    <Box
      sx={{
        bgcolor: "white",
        borderRadius: 1,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        flexShrink: 0,
      }}
    >
      <Box
        sx={{
          px: 2,
          pt: 1.5,
          pb: 0.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          Modifier une couleur
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {hasColor && (
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: "4px",
                bgcolor: colorToReplace,
                border: "1px solid",
                borderColor: "divider",
                flexShrink: 0,
              }}
            />
          )}
          <IconButton
            size="small"
            onClick={handlePickColor}
            color={isPicking ? "primary" : "default"}
            title="Sélectionner une couleur sur l'image"
          >
            <Colorize fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      <Box>
        <ListItemButton
          onClick={() => handleReplace("#FFFFFF", "Supprimer la couleur")}
          disabled={!hasColor || !!loading}
          divider
        >
          {loading === "Supprimer la couleur" ? (
            <CircularProgress size={18} sx={{ mr: 1 }} />
          ) : null}
          <Typography variant="body2" color="text.secondary">
            Supprimer la couleur
          </Typography>
        </ListItemButton>

        <ListItemButton
          onClick={() => handleReplace("#000000", "Remplir en noir")}
          disabled={!hasColor || !!loading}
        >
          {loading === "Remplir en noir" ? (
            <CircularProgress size={18} sx={{ mr: 1 }} />
          ) : null}
          <Typography variant="body2" color="text.secondary">
            Remplir en noir
          </Typography>
        </ListItemButton>
      </Box>
    </Box>
  );
}
