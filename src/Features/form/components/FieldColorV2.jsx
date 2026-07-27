import { useState } from "react";
import { CirclePicker } from "react-color";
import { Box, Typography, Popover } from "@mui/material";
import defaultColors from "Features/colors/data/defaultColors";
import ColorPickerContent from "Features/colors/components/ColorPickerContent";
import WhiteSectionGeneric from "./WhiteSectionGeneric";

export default function FieldColorV2({
  value,
  onChange,
  label,
  options,
  action,
  endAction,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const showAsSection = options?.showAsSection;

  // Handlers pour le Popover
  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  // react-color (CirclePicker) hands back a color object; the shared picker a hex.
  const handleCirclePickerChange = (color) => {
    onChange(color.hex);
  };

  const open = Boolean(anchorEl);
  const id = open ? "color-popover" : undefined;

  if (showAsSection) {
    return (
      <>
        <WhiteSectionGeneric>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: 1,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              {label}
            </Typography>

            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              {action}

              {/* Le rond de couleur cliquable */}
              <Box
                onClick={handleClick}
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  bgcolor: value || "#fff",
                  cursor: "pointer",
                  border: "2px solid",
                  borderColor: "divider",
                  "&:hover": { transform: "scale(1.1)" },
                  transition: "transform 0.2s",
                }}
              />

              {endAction}
            </Box>
          </Box>
        </WhiteSectionGeneric>

        {/* Menu déroulant (Popover) — palette de marque partagée */}
        <Popover
          id={id}
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{
            paper: { sx: { mt: 1, borderRadius: 2, boxShadow: 6 } },
          }}
        >
          <ColorPickerContent
            color={value}
            onColorChange={onChange}
            onClose={handleClose}
          />
        </Popover>
      </>
    );
  }

  // Rendu par défaut (inchangé mais nettoyé)
  return (
    <Box sx={{ width: 1 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 1,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {label}
        </Typography>
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 1,
          width: 1,
        }}
      >
        <CirclePicker
          onChange={handleCirclePickerChange}
          color={value}
          colors={defaultColors}
          circleSize={16}
          circleSpacing={9}
        />
      </Box>
    </Box>
  );
}
