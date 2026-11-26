import { useState } from "react";
import { useDispatch } from "react-redux";

import {
  Divider,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";

import useRevolutionAxes from "Features/annotations/hooks/useRevolutionAxes";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import CommandButton from "../../components/CommandButton";
import {
  startDrawRevolutionAxisOnSection,
  startPlaceRevolutionAxis,
} from "../revolutionAxis/startRevolutionAxisTools";

// Toolbar button of « Axe sur plan de coupe »: always a menu. First entry:
// draw a NEW axis on the current vertical base map (two clicks: foot, then
// half base + height — needs a scale); then the revolution axes of the scope,
// picking one arms its placement click (which poses the base map in 3D).
export default function ButtonPlaceRevolutionAxis({
  command,
  state,
  hotkeyLabel,
}) {
  const dispatch = useDispatch();

  // strings

  const tooltipS =
    "Dessiner ou poser un axe de révolution sur ce plan de coupe";
  const drawS = "Dessiner un nouvel axe";
  const drawHintS = "2 clics : base, puis demi-largeur et hauteur";
  const noScaleS = "Fond de plan sans échelle";
  const placeS = "Poser un axe existant";

  // data

  const revolutionAxes = useRevolutionAxes();
  const baseMap = useMainBaseMap();
  const meterByPx = baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx;
  const hasScale = Number.isFinite(meterByPx) && meterByPx > 0;

  // state

  const [menuAnchor, setMenuAnchor] = useState(null);

  // handlers

  function handleClick(event, anchor) {
    setMenuAnchor(anchor);
  }

  function handleDrawAxis() {
    setMenuAnchor(null);
    startDrawRevolutionAxisOnSection(dispatch);
  }

  function handleSelectAxis(axis) {
    setMenuAnchor(null);
    startPlaceRevolutionAxis(dispatch, axis);
  }

  // render

  return (
    <>
      <CommandButton
        commandKey={command.key}
        label={`${command.label} — ${tooltipS}`}
        Icon={command.Icon}
        hotkeyLabel={hotkeyLabel}
        state={state}
        onClick={handleClick}
      />
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <Tooltip title={hasScale ? "" : noScaleS} placement="right" arrow>
          <span>
            <MenuItem dense disabled={!hasScale} onClick={handleDrawAxis}>
              <ListItemText
                primary={drawS}
                secondary={drawHintS}
                slotProps={{
                  primary: { variant: "body2" },
                  secondary: { variant: "caption" },
                }}
              />
            </MenuItem>
          </span>
        </Tooltip>
        {revolutionAxes.length > 0 && <Divider />}
        {revolutionAxes.length > 0 && (
          <ListSubheader sx={{ lineHeight: "28px", fontSize: "0.7rem" }}>
            {placeS}
          </ListSubheader>
        )}
        {revolutionAxes.map((axis) => (
          <MenuItem key={axis.id} dense onClick={() => handleSelectAxis(axis)}>
            <ListItemText
              primary={axis.label ?? "Axe"}
              slotProps={{ primary: { variant: "body2" } }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
