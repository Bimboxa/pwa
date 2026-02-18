import { useState } from "react";
import { CompactPicker, CirclePicker } from "react-color";
import { Box, Typography, Popover, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import defaultColors from "Features/colors/data/defaultColors";
import WhiteSectionGeneric from "./WhiteSectionGeneric";

export default function FieldColorV2({ value, onChange, label, options }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const showAsSection = options?.showAsSection;

  // Handlers pour le Popover
  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleColorChange = (color) => {
    onChange(color.hex);
    // Optionnel : fermer le menu après sélection
    // handleClose(); 
  };

  const open = Boolean(anchorEl);
  const id = open ? 'color-popover' : undefined;

  if (showAsSection) {
    return (
      <>
        <WhiteSectionGeneric>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: 1
          }}>
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>{label}</Typography>

            {/* Le rond de couleur cliquable */}
            <Box
              onClick={handleClick}
              sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                bgcolor: value || '#fff',
                cursor: 'pointer',
                border: '2px solid',
                borderColor: 'divider',
                '&:hover': { transform: 'scale(1.1)' },
                transition: 'transform 0.2s'
              }}
            />
          </Box>
        </WhiteSectionGeneric>

        {/* Menu déroulant (Popover) */}
        <Popover
          id={id}
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          slotProps={{
            paper: { sx: { mt: 1, p: 0, overflow: 'hidden', borderRadius: 2 } }
          }}
        >
          {/* Entête du Menu */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pl: 2, pr: 1, py: 0.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'action.hover'
          }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              Sélectionner une couleur
            </Typography>
            <IconButton size="small" onClick={handleClose}>
              <CloseIcon fontSize="inherit" />
            </IconButton>
          </Box>

          {/* Sélecteur de couleur */}
          <Box sx={{ p: 1 }}>
            <CompactPicker
              onChange={handleColorChange}
              color={value}
            />
          </Box>
        </Popover>
      </ >
    );
  }

  // Rendu par défaut (inchangé mais nettoyé)
  return (
    <Box sx={{ width: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", p: 1, borderTop: (theme) => `1px solid ${theme.palette.divider}` }}>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>{label}</Typography>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", p: 1, width: 1 }}>
        <CirclePicker
          onChange={handleColorChange}
          color={value}
          colors={defaultColors}
          circleSize={16}
          circleSpacing={9}
        />
      </Box>
    </Box>
  );
}