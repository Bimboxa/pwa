import { useState } from "react";
import { Box, Typography, Popover, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import SelectorIconGeneric from "Features/layout/components/SelectorIconGeneric";
import WhiteSectionGeneric from "./WhiteSectionGeneric";

export default function FieldIconBasic({ value, onChange, label, options }) {

  const iconsMap = options?.iconsMap;
  const iconColor = options?.iconColor;
  const showAsSection = options?.showAsSection;

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const SelectedIcon = value && iconsMap?.get(value);

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
              width: 32,
              height: 32,
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: value ? iconColor : 'action.hover',
              color: value ? 'white' : 'text.secondary',
              cursor: 'pointer',
              '&:hover': { transform: 'scale(1.1)' },
              transition: 'transform 0.2s'
            }}
          >
            {SelectedIcon && <SelectedIcon fontSize="small" />}
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

        <Box sx={{ p: 1, width: 300 }}>
          <SelectorIconGeneric
            iconKey={value}
            iconColor={iconColor}
            onChange={(key) => { onChange(key); setAnchorEl(null); }}
            iconsMap={iconsMap}
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
        <SelectorIconGeneric
          iconKey={value}
          iconColor={iconColor}
          onChange={onChange}
          iconsMap={iconsMap}
        />
      </Box>
    </Box>
  );
}
