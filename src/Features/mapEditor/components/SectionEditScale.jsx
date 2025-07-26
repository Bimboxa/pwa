import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import {
  triggerBaseMapsUpdate,
  updateMap,
} from "Features/baseMaps/baseMapsSlice";

import useLoadedMainBaseMap from "../hooks/useLoadedMainBaseMap";

import { Paper, TextField, Button, Typography } from "@mui/material";
import { setAnchorPositionScale } from "../mapEditorSlice";

export default function SectionEditScale() {
  const dispatch = useDispatch();

  // string

  const label = "Distance (m)";
  const saveS = "Enregistrer";

  // state

  const [targetDistance, setTargetDistance] = useState();

  // data

  const loadedMainBaseMap = useLoadedMainBaseMap();
  const scaleInPx = useSelector((s) => s.mapEditor.scaleInPx);

  // helper

  const meterByPx = loadedMainBaseMap?.meterByPx ?? 1;
  const currentDistance = scaleInPx * meterByPx;

  // helper - disable

  let delta = 0;
  if (targetDistance) {
    delta = Math.abs(currentDistance - targetDistance) / currentDistance;
  }
  const disabled = !targetDistance || delta < 0.0001;

  // helper

  const value = targetDistance ?? currentDistance.toFixed(3);

  // handlers

  function handleChange(e) {
    let distanceS = e.target.value;
    distanceS = distanceS.replace(",", ".");
    setTargetDistance(distanceS);
  }

  function handleSave() {
    const updates = {
      id: loadedMainBaseMap.id,
      meterByPx: targetDistance / scaleInPx,
    };
    dispatch(updateMap(updates));
    dispatch(triggerBaseMapsUpdate());
    dispatch(setAnchorPositionScale(null));
  }

  return (
    <Paper sx={{ display: "flex", alignItems: "center", p: 2 }}>
      <TextField
        sx={{ width: 100 }}
        value={value}
        onChange={handleChange}
        label={label}
      />
      <Button
        disabled={disabled}
        onClick={handleSave}
        sx={{ ml: 2 }}
        variant="contained"
      >
        <Typography>{saveS}</Typography>
      </Button>
    </Paper>
  );
}
