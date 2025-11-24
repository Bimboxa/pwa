import { useDispatch, useSelector } from "react-redux";

import { setOpencvClickMode, removeSelectedColor } from "../opencvSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { Box, Typography, IconButton, useTheme } from "@mui/material";
import { Add as AddIcon, Remove as RemoveIcon } from "@mui/icons-material";

export default function SectionColorPicker() {
  const theme = useTheme();
  const dispatch = useDispatch();

  // strings

  const label = "Choisir une couleur";

  // data

  const selectedColors = useSelector((state) => state.opencv.selectedColors);
  console.log("debug_2011_selectedColors", selectedColors);

  // helpers

  const showLabel = !selectedColors?.length > 0;

  // handlers

  function handleAddClick() {
    dispatch(setOpencvClickMode("COLOR_PICKER"));
    dispatch(setEnabledDrawingMode("OPENCV"));
  }

  function handleRemoveClick(color) {
    dispatch(removeSelectedColor(color));
  }

  // return

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: 1, p: 1 }}>
      {showLabel && (
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      )}
      {selectedColors.map((color) => {
        const normalizedColor =
          typeof color === "string" ? color : color?.color ?? "#000";
        const contrastColor = theme.palette.getContrastText(normalizedColor);
        return (
          <Box
            key={normalizedColor}
            sx={{
              bgcolor: normalizedColor,
              borderRadius: "8px",
              width: 24,
              height: 24,
              position: "relative",
              "&:hover .remove-icon": {
                opacity: 1,
              },
            }}
          >
            <IconButton
              className="remove-icon"
              onClick={() => handleRemoveClick(normalizedColor)}
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                borderRadius: "8px",
                color: contrastColor,
                opacity: 0,
                transition: "opacity 0.2s ease",
              }}
            >
              <RemoveIcon />
            </IconButton>
          </Box>
        );
      })}
      <IconButton
        onClick={handleAddClick}
        sx={{
          borderRadius: "8px",
          width: 24,
          height: 24,
        }}
      >
        <AddIcon color="primary" />
      </IconButton>
    </Box>
  );
}
