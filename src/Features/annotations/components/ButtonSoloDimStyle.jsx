import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSoloDimStyle } from "Features/viewers/viewersSlice";

import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Tooltip,
} from "@mui/material";
import ArrowDropDown from "@mui/icons-material/ArrowDropDown";

import { FLOATING_BUTTON_PADDING } from "Features/baseMapsGrid/components/ButtonBaseMapsGrid";

import {
  SOLO_DIM_STYLE_OPTIONS,
  getNextSoloDimStyle,
  getSoloDimStyleOption,
} from "Features/annotations/constants/soloDimStyle";

// Bottom bar split button of the look of the annotations LEFT OUT of a solo
// (hidden / light grey wireframe / translucent — SOLO_DIM_STYLE_OPTIONS),
// shown while a solo is active (selectIsAnySoloActive). Main part: icon of
// the current style, a click moves to the next one; arrow: menu of the
// three styles. Same flat Paper look as the other bottom bar controls
// (SectionBaseMapsBottomBarControls: 36 px buttons, MUI action color).
export default function ButtonSoloDimStyle() {
  const dispatch = useDispatch();

  // data

  const style = useSelector((s) => s.viewers.soloDimStyle);
  const option = getSoloDimStyleOption(style);

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  // handlers

  function handleNext() {
    dispatch(setSoloDimStyle(getNextSoloDimStyle(style)));
  }

  function handleOpen(e) {
    setAnchorEl(e.currentTarget.closest(".MuiPaper-root") ?? e.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function handleSelect(key) {
    dispatch(setSoloDimStyle(key));
    handleClose();
  }

  // render

  const CurrentIcon = option.Icon;

  return (
    <Paper
      elevation={3}
      sx={{
        borderRadius: "10px",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <Tooltip title={option.tooltip}>
        <IconButton onClick={handleNext} sx={{ p: FLOATING_BUTTON_PADDING }}>
          <CurrentIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="Choisir le style des annotations hors solo">
        <IconButton
          size="small"
          onClick={handleOpen}
          sx={{
            p: 0,
            ml: "-6px",
            mr: "2px",
            width: 16,
            height: 30,
            borderRadius: "4px",
            color: open ? "secondary.main" : "text.disabled",
            "& .MuiSvgIcon-root": { fontSize: 16 },
          }}
        >
          <ArrowDropDown />
        </IconButton>
      </Tooltip>
      <Menu
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        {SOLO_DIM_STYLE_OPTIONS.map(({ key, label, Icon }) => (
          <MenuItem
            key={key}
            selected={key === style}
            onClick={() => handleSelect(key)}
          >
            <ListItemIcon>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              <Box component="span" sx={{ fontSize: 14 }}>
                {label}
              </Box>
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Paper>
  );
}
