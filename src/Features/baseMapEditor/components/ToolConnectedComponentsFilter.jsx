import { useState } from "react";

import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Tooltip,
  Menu,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";

const PRESETS = [
  { minArea: 50, boxSize: 5 },
  { minArea: 200, boxSize: 8 },
  { minArea: 500, boxSize: 12 },
];

const DEFAULT_CUSTOM_MIN_AREA = 1000;

export default function ToolConnectedComponentsFilter({ baseMap, onResult }) {
  // state

  const [loading, setLoading] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [customMinArea, setCustomMinArea] = useState(DEFAULT_CUSTOM_MIN_AREA);
  const [customTextOnly, setCustomTextOnly] = useState(false);

  // handlers

  async function runFilter(minArea, textOnly, key) {
    const imageUrl = baseMap?.getUrl();
    if (!imageUrl || !onResult) return;

    setLoading(key);
    try {
      const cv = (await import("Features/opencv/services/opencvService"))
        .default;
      await cv.load();
      const { processedImageFile } = await cv.filterConnectedComponentsAsync({
        imageUrl,
        minArea,
        textOnly,
      });
      if (processedImageFile) {
        const label = textOnly
          ? `Amas < ${minArea} (texte)`
          : `Amas < ${minArea}`;
        onResult(processedImageFile, label);
      }
    } finally {
      setLoading(null);
    }
  }

  function handlePresetClick(minArea) {
    runFilter(minArea, false, `preset_${minArea}`);
  }

  function handleOpenMenu(event) {
    setMenuAnchor(event.currentTarget);
  }

  function handleCloseMenu() {
    setMenuAnchor(null);
  }

  function handleMinAreaChange(e) {
    const value = parseInt(e.target.value, 10);
    if (Number.isNaN(value)) return;
    setCustomMinArea(value);
  }

  async function handleApplyCustom() {
    const minArea = customMinArea;
    const textOnly = customTextOnly;
    handleCloseMenu();
    if (minArea > 0) {
      await runFilter(minArea, textOnly, "custom");
    }
  }

  // render

  return (
    <Box
      sx={{
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        px: 2,
        py: 1,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          py: 0.25,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Effacer les petits amas
        </Typography>
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
          {PRESETS.map(({ minArea, boxSize }) => {
            const key = `preset_${minArea}`;
            const isLoading = loading === key;
            return (
              <Tooltip key={minArea} title={`Aire min ${minArea} px`}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => handlePresetClick(minArea)}
                    disabled={!!loading}
                  >
                    {isLoading ? (
                      <CircularProgress size={16} />
                    ) : (
                      <Box
                        sx={{
                          width: boxSize,
                          height: boxSize,
                          border: "2px solid",
                          borderColor: "text.secondary",
                          borderRadius: 0.5,
                        }}
                      />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            );
          })}
          <Tooltip title={`Aire min ${customMinArea} px`}>
            <span>
              <IconButton
                size="small"
                onClick={handleOpenMenu}
                disabled={!!loading}
              >
                {loading === "custom" ? (
                  <CircularProgress size={16} />
                ) : (
                  <MoreHorizIcon fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleCloseMenu}
      >
        <Box
          sx={{
            px: 2,
            py: 1,
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          <TextField
            label="Aire min (px)"
            type="number"
            size="small"
            value={customMinArea}
            onChange={handleMinAreaChange}
            inputProps={{ min: 1, step: 1 }}
            autoFocus
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={customTextOnly}
                onChange={(e) => setCustomTextOnly(e.target.checked)}
              />
            }
            label={
              <Typography variant="body2">Motif / texte uniquement</Typography>
            }
          />
          <Button variant="contained" size="small" onClick={handleApplyCustom}>
            Appliquer
          </Button>
        </Box>
      </Menu>
    </Box>
  );
}
