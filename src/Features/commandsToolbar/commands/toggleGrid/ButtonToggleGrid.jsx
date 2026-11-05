import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setEditorGridDynamic,
  setEditorGridEnabled,
  setEditorGridStepM,
} from "Features/editorGrid/editorGridSlice";

import {
  Box,
  Divider,
  IconButton,
  InputAdornment,
  ListItemText,
  MenuItem,
  MenuList,
  Popover,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";

import CommandButton from "../../components/CommandButton";
import { useCommandMenu } from "../../components/CommandMenuContext";

import formatGridStep from "Features/editorGrid/utils/formatGridStep";

const STEP_PRESETS_M = [0.1, 0.25, 0.5, 1, 2, 5, 10];

// Button of « Grille »: the toggle itself, plus — in the toolbar row — a
// small arrow opening the grid options: cell size (presets or a typed value)
// and « Grille dynamique ». Picking an option also turns the grid on. In a
// menu (right-click shortcuts) only the toggle is offered.
export default function ButtonToggleGrid({ command, state, hotkeyLabel }) {
  const dispatch = useDispatch();
  const menu = useCommandMenu();
  const isMenu = menu?.variant === "menu";

  // strings

  const optionsS = "Options de la grille";
  const cellSizeS = "Taille de la maille";
  const otherS = "Autre";
  const dynamicS = "Grille dynamique";
  const dynamicHelperS = "La maille suit le niveau de zoom";

  // data

  const gridEnabled = useSelector((s) => s.editorGrid.enabled);
  const stepM = useSelector((s) => s.editorGrid.stepM);
  const dynamic = useSelector((s) => s.editorGrid.dynamic);

  // state

  const [rootEl, setRootEl] = useState(null);
  const [open, setOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");

  // helpers

  const finalState = state.enabled
    ? { ...state, active: gridEnabled }
    : state;
  const sizeS = dynamic ? dynamicS.toLowerCase() : formatGridStep(stepM);
  const label = gridEnabled ? `${command.label} — ${sizeS}` : command.label;
  const isPreset = STEP_PRESETS_M.includes(stepM);

  // handlers

  function handleToggle() {
    dispatch(setEditorGridEnabled(!gridEnabled));
  }

  function handleOpen() {
    setCustomValue(isPreset ? "" : String(stepM).replace(".", ","));
    setOpen(true);
  }

  function handlePickStep(value) {
    dispatch(setEditorGridStepM(value));
    dispatch(setEditorGridDynamic(false));
    dispatch(setEditorGridEnabled(true));
  }

  function commitCustomValue() {
    const value = Number(String(customValue).replace(",", ".").trim());
    if (!(value > 0) || value === stepM) return;
    handlePickStep(value);
  }

  function handleDynamicChange() {
    dispatch(setEditorGridDynamic(!dynamic));
    dispatch(setEditorGridEnabled(true));
  }

  // render

  const button = (
    <CommandButton
      commandKey={command.key}
      label={isMenu ? command.label : label}
      Icon={command.Icon}
      hotkeyLabel={hotkeyLabel}
      state={finalState}
      onClick={handleToggle}
    />
  );

  if (isMenu) return button;

  return (
    <Box
      ref={setRootEl}
      sx={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
    >
      {button}
      <Tooltip title={optionsS} enterDelay={400}>
        <span>
          <IconButton
            size="small"
            onClick={handleOpen}
            disabled={!state.enabled}
            sx={{
              p: 0,
              ml: "-6px",
              width: 14,
              height: 30,
              borderRadius: "4px",
              color: open ? "secondary.main" : "text.disabled",
              "& .MuiSvgIcon-root": { fontSize: 16 },
            }}
          >
            <ArrowDropDownIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={rootEl}
        onClose={() => setOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { width: 240 } } }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", px: 2, pt: 1.5, pb: 0.5 }}
        >
          {cellSizeS}
        </Typography>
        <MenuList dense disablePadding>
          {STEP_PRESETS_M.map((value) => (
            <MenuItem
              key={value}
              selected={!dynamic && stepM === value}
              disabled={dynamic}
              onClick={() => handlePickStep(value)}
            >
              <ListItemText
                primary={formatGridStep(value)}
                slotProps={{ primary: { variant: "body2" } }}
              />
            </MenuItem>
          ))}
        </MenuList>
        <Box sx={{ px: 2, py: 1 }}>
          <TextField
            size="small"
            fullWidth
            label={otherS}
            value={customValue}
            disabled={dynamic}
            onChange={(e) => setCustomValue(e.target.value)}
            onBlur={commitCustomValue}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitCustomValue();
            }}
            slotProps={{
              input: {
                endAdornment: <InputAdornment position="end">m</InputAdornment>,
              },
            }}
          />
        </Box>
        <Divider />
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            px: 2,
            py: 1,
          }}
        >
          <Box>
            <Typography variant="body2">{dynamicS}</Typography>
            <Typography variant="caption" color="text.secondary">
              {dynamicHelperS}
            </Typography>
          </Box>
          <Switch size="small" checked={dynamic} onChange={handleDynamicChange} />
        </Box>
      </Popover>
    </Box>
  );
}
