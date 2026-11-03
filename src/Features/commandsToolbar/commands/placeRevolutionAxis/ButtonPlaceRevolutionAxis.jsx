import { useState } from "react";
import { useDispatch } from "react-redux";

import { ListItemText, Menu, MenuItem } from "@mui/material";

import useRevolutionAxes from "Features/annotations/hooks/useRevolutionAxes";

import CommandButton from "../../components/CommandButton";
import { startPlaceRevolutionAxis } from "../revolutionAxis/startRevolutionAxisTools";

// Toolbar button of « Axe sur plan de coupe »: a menu of the revolution axes
// of the scope (always a menu, even with a single axis); picking one arms the
// placement click on the current vertical base map. Disabled with a reason
// while the scope has no axis yet.
export default function ButtonPlaceRevolutionAxis({
  command,
  state,
  hotkeyLabel,
}) {
  const dispatch = useDispatch();

  // strings

  const placeS = "Poser un axe de révolution existant sur ce plan de coupe";
  const noAxisS = "Créez d'abord un axe sur un fond de plan horizontal";

  // data

  const revolutionAxes = useRevolutionAxes();

  // state

  const [menuAnchor, setMenuAnchor] = useState(null);

  // helpers

  let finalState = state;
  if (state.enabled && revolutionAxes.length === 0) {
    finalState = { enabled: false, reason: noAxisS };
  }

  // handlers

  function handleClick(event, anchor) {
    if (revolutionAxes.length === 0) return;
    setMenuAnchor(anchor);
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
        label={`${command.label} — ${placeS}`}
        Icon={command.Icon}
        hotkeyLabel={hotkeyLabel}
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
