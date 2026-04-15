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
} from "@mui/material";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";

const KERNEL_SIZES = [
  { size: 2, boxSize: 5 },
  { size: 3, boxSize: 8 },
  { size: 5, boxSize: 12 },
];

const DEFAULT_CUSTOM_KERNEL = 7;

const OPERATIONS = [
  { morphType: "open", label: "Effacer les traits fins" },
  { morphType: "close", label: "Fermer les trous" },
];

export default function ToolMorphology({ baseMap, onResult }) {
  // state

  const [loading, setLoading] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuMorphType, setMenuMorphType] = useState(null);
  const [customKernel, setCustomKernel] = useState({
    open: DEFAULT_CUSTOM_KERNEL,
    close: DEFAULT_CUSTOM_KERNEL,
  });

  // handlers

  async function handleClick(morphType, kernelSize) {
    const imageUrl = baseMap?.getUrl();
    if (!imageUrl || !onResult) return;

    const key = `${morphType}_${kernelSize}`;
    setLoading(key);
    try {
      const cv = (await import("Features/opencv/services/opencvService"))
        .default;
      await cv.load();
      const { processedImageFile } = await cv.applyMorphologyAsync({
        imageUrl,
        morphType,
        kernelSize,
      });
      if (processedImageFile) {
        const label =
          morphType === "open"
            ? `Ouverture ${kernelSize}`
            : `Fermeture ${kernelSize}`;
        onResult(processedImageFile, label);
      }
    } finally {
      setLoading(null);
    }
  }

  function handleOpenMenu(event, morphType) {
    setMenuAnchor(event.currentTarget);
    setMenuMorphType(morphType);
  }

  function handleCloseMenu() {
    setMenuAnchor(null);
    setMenuMorphType(null);
  }

  function handleKernelChange(e) {
    const value = parseInt(e.target.value, 10);
    if (Number.isNaN(value)) return;
    setCustomKernel((prev) => ({ ...prev, [menuMorphType]: value }));
  }

  async function handleApplyCustom() {
    const morphType = menuMorphType;
    const kernelSize = customKernel[morphType];
    handleCloseMenu();
    if (kernelSize > 0) {
      await handleClick(morphType, kernelSize);
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
      {OPERATIONS.map(({ morphType, label }) => (
        <Box
          key={morphType}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            py: 0.25,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
            {KERNEL_SIZES.map(({ size, boxSize }) => {
              const key = `${morphType}_${size}`;
              const isLoading = loading === key;
              return (
                <Tooltip key={size} title={`Kernel ${size}×${size}`}>
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => handleClick(morphType, size)}
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
            <Tooltip
              title={`Kernel ${customKernel[morphType]}×${customKernel[morphType]}`}
            >
              <span>
                <IconButton
                  size="small"
                  onClick={(e) => handleOpenMenu(e, morphType)}
                  disabled={!!loading}
                >
                  <MoreHorizIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      ))}
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
            label="Kernel"
            type="number"
            size="small"
            value={menuMorphType ? customKernel[menuMorphType] : ""}
            onChange={handleKernelChange}
            inputProps={{ min: 1, step: 1 }}
            autoFocus
          />
          <Button variant="contained" size="small" onClick={handleApplyCustom}>
            Appliquer
          </Button>
        </Box>
      </Menu>
    </Box>
  );
}
