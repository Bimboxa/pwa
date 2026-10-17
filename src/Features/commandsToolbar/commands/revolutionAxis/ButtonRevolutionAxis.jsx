import { useState } from "react";
import { useDispatch } from "react-redux";

import { ListItemText, Menu, MenuItem } from "@mui/material";

import useRevolutionAxes from "Features/annotations/hooks/useRevolutionAxes";

import CommandButton from "../../components/CommandButton";
import { startPlaceRevolutionAxis } from "./startRevolutionAxisTools";

// Toolbar button of « Axe de révolution »: draws an axis (command.run), or —
// 2D editor on a VERTICAL base map — drops an existing axis of the scope: one
// click when the scope has a single axis, a menu otherwise; disabled when it
// has none.
export default function ButtonRevolutionAxis({
  command,
  ctx,
  deps,
  state,
  hotkeyLabel,
}) {
  const dispatch = useDispatch();

  // strings

  const drawS = "Dessiner un axe : centre, puis rayon et direction";
  const draw3dS =
    "Dessiner un axe sur un plan horizontal : centre, puis rayon et direction";
  const placeS = "Poser un axe de révolution sur ce fond de plan";
  const noAxisS = "Créez d'abord un axe sur un fond de plan horizontal";

  // data

  const revolutionAxes = useRevolutionAxes();

  // state

  const [menuAnchor, setMenuAnchor] = useState(null);

  // helpers

  const isVertical = !ctx.isThreedEditor && ctx.isVerticalBaseMap;
  let label = ctx.isThreedEditor ? draw3dS : isVertical ? placeS : drawS;
  let finalState = state;
  if (state.enabled && isVertical && revolutionAxes.length === 0) {
    finalState = { enabled: false, reason: noAxisS };
  }

  // handlers

  function handleClick(event, anchor) {
    if (!isVertical) {
      command.run(ctx, deps);
      return;
    }
    if (revolutionAxes.length === 1) {
      startPlaceRevolutionAxis(dispatch, revolutionAxes[0]);
    } else if (revolutionAxes.length > 1) {
      setMenuAnchor(anchor);
    }
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
        label={`${command.label} — ${label}`}
        Icon={command.Icon}
        hotkeyLabel={isVertical ? null : hotkeyLabel}
        state={finalState}
        onClick={handleClick}
      />
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
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
