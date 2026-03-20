import { useState } from "react";

import { Box, Typography, IconButton, CircularProgress } from "@mui/material";

const KERNEL_SIZES = [
  { size: 3, boxSize: 8 },
  { size: 5, boxSize: 12 },
  { size: 7, boxSize: 16 },
];

const OPERATIONS = [
  { morphType: "open", label: "Effacer les traits fins" },
  { morphType: "close", label: "Fermer les trous" },
];

export default function ToolMorphology({ baseMap, onResult }) {
  // state

  const [loading, setLoading] = useState(null);

  // handlers

  async function handleClick(morphType, kernelSize) {
    const imageUrl = baseMap?.getUrl();
    if (!imageUrl || !onResult) return;

    const key = `${morphType}_${kernelSize}`;
    setLoading(key);
    try {
      const cv = (await import("Features/opencv/services/opencvService")).default;
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
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {KERNEL_SIZES.map(({ size, boxSize }) => {
              const key = `${morphType}_${size}`;
              const isLoading = loading === key;
              return (
                <IconButton
                  key={size}
                  size="small"
                  onClick={() => handleClick(morphType, size)}
                  disabled={!!loading}
                  title={`Kernel ${size}×${size}`}
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
              );
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
