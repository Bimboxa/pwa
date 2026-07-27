import { useState } from "react";

import { Box, Typography, ButtonBase, Popover, Tooltip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { KeyboardArrowDown, MoreHoriz } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import DRAWING_SHAPES from "Features/annotations/constants/drawingShapes.jsx";

// Design "3a": the two priority shapes (Ligne / Surface) stay visible as a
// segmented control, the remaining shapes live behind an "Autre" popover.
const PRIMARY_KEYS = ["POLYLINE", "POLYGON"];

export default function FieldAnnotationTemplateDrawingShape({
  value,
  onChange,
}) {
  // data

  const primaryShapes = PRIMARY_KEYS.map((key) =>
    DRAWING_SHAPES.find((shape) => shape.key === key)
  ).filter(Boolean);
  const otherShapes = DRAWING_SHAPES.filter(
    (shape) => !PRIMARY_KEYS.includes(shape.key)
  );

  const selectedShape = DRAWING_SHAPES.find((shape) => shape.key === value);
  const isOtherSelected = otherShapes.some((shape) => shape.key === value);

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // handlers

  function handleSelect(key) {
    onChange(key);
    setAnchorEl(null);
  }

  function handleOpenOthers(e) {
    setAnchorEl(e.currentTarget);
  }

  function handleCloseOthers() {
    setAnchorEl(null);
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
          Forme 2D
        </Typography>

        {/* Segmented control — the two priority shapes, always visible */}
        <Box
          sx={{
            display: "flex",
            gap: 0.4,
            p: 0.4,
            bgcolor: "grey.100",
            borderRadius: 1,
          }}
        >
          {primaryShapes.map((shape) => {
            const selected = value === shape.key;
            return (
              <Tooltip key={shape.key} title={shape.label}>
                <ButtonBase
                  onClick={() => handleSelect(shape.key)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 30,
                    height: 28,
                    borderRadius: 0.8,
                    color: selected ? "secondary.main" : "text.secondary",
                    bgcolor: selected ? "background.paper" : "transparent",
                    boxShadow: selected ? 1 : "none",
                  }}
                >
                  {shape.icon}
                </ButtonBase>
              </Tooltip>
            );
          })}
        </Box>

        {/* "Autre" button — the remaining shapes behind a popover */}
        <Tooltip title={isOtherSelected ? selectedShape.label : "Autre forme"}>
          <ButtonBase
            onClick={handleOpenOthers}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              height: 32,
              px: 0.8,
              borderRadius: 1,
              border: 1,
              borderColor: isOtherSelected ? "secondary.main" : "divider",
              bgcolor: isOtherSelected
                ? (theme) => alpha(theme.palette.secondary.main, 0.12)
                : "background.paper",
              color: isOtherSelected ? "secondary.main" : "text.secondary",
            }}
          >
            {isOtherSelected ? (
              <>
                {selectedShape.icon}
                <Typography
                  variant="caption"
                  sx={{ fontWeight: 500, color: "secondary.main" }}
                >
                  {selectedShape.label}
                </Typography>
              </>
            ) : (
              <MoreHoriz fontSize="small" />
            )}
            <KeyboardArrowDown sx={{ fontSize: 16, opacity: 0.5 }} />
          </ButtonBase>
        </Tooltip>

        <Popover
          open={open}
          anchorEl={anchorEl}
          onClose={handleCloseOthers}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 0.5,
              width: 220,
              p: 1,
            }}
          >
            {otherShapes.map((shape) => {
              const selected = value === shape.key;
              return (
                <ButtonBase
                  key={shape.key}
                  onClick={() => handleSelect(shape.key)}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 0.5,
                    p: 1,
                    borderRadius: 1,
                    color: selected ? "secondary.main" : "text.secondary",
                    bgcolor: selected
                      ? (theme) => alpha(theme.palette.secondary.main, 0.12)
                      : "transparent",
                    "&:hover": {
                      bgcolor: selected
                        ? (theme) => alpha(theme.palette.secondary.main, 0.18)
                        : "action.hover",
                    },
                  }}
                >
                  {shape.icon}
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: 10.5,
                      lineHeight: 1.2,
                      textAlign: "center",
                      color: selected ? "secondary.main" : "text.secondary",
                    }}
                  >
                    {shape.label}
                  </Typography>
                </ButtonBase>
              );
            })}
          </Box>
        </Popover>
      </Box>
    </WhiteSectionGeneric>
  );
}
