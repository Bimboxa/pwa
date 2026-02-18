import { useState } from "react";
import SelectorMarkerIcon from "Features/markers/components/SelectorMarkerIcon";
import MarkerIcon from "Features/markers/components/MarkerIcon";

import { Box, Typography, Popover, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import WhiteSectionGeneric from "./WhiteSectionGeneric";

export default function FieldIcon({
  value,
  onChange,
  label,
  spriteImage,
  options,
}) {

  // options

  const iconColor = options?.iconColor;
  const showAsSection = options?.showAsSection;

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  if (showAsSection) {
    return <>
      <WhiteSectionGeneric>
        <Box sx={{ display: "flex", alignItems: "center", width: 1, justifyContent: "space-between" }}>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {label}
          </Typography>

          <Box
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{
              width: 24,
              height: 24,
              border: theme => `2px solid ${theme.palette.divider}`,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: value ? iconColor : 'action.hover',
              cursor: 'pointer',
              '&:hover': { transform: 'scale(1.1)' },
              transition: 'transform 0.2s'
            }}
          >
            <MarkerIcon
              iconKey={value}
              spriteImage={spriteImage}
              size={28}
              fillColor={iconColor}
            />
          </Box>
        </Box>
      </WhiteSectionGeneric>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: { sx: { mt: 1, p: 0, overflow: 'hidden', borderRadius: 2 } }
        }}
      >
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
            {label}
          </Typography>
          <IconButton size="small" onClick={() => setAnchorEl(null)}>
            <CloseIcon fontSize="inherit" />
          </IconButton>
        </Box>

        <Box sx={{ p: 1, width: 210, boxSizing: "border-box" }}>
          <SelectorMarkerIcon
            iconKey={value}
            onChange={(key) => { onChange(key); setAnchorEl(null); }}
            spriteImage={spriteImage}
            iconColor={iconColor}
            size={24}
            cols={4}
          />
        </Box>
      </Popover>
    </>
  }

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
      <Box sx={{ display: "flex", justifyContent: "center", p: 1 }}>
        <SelectorMarkerIcon
          iconKey={value}
          onChange={onChange}
          spriteImage={spriteImage}
          iconColor={iconColor}
        />
      </Box>
    </Box>
  );
}
