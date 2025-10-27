import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import {
  setAnchorPositionScale,
  setScaleAnnotationId,
} from "../mapEditorSlice";

import {
  triggerBaseMapsUpdate,
  updateMap,
} from "Features/baseMaps/baseMapsSlice";

import useMainBaseMap from "../hooks/useMainBaseMap";

import useDeleteAnnotation from "Features/annotations/hooks/useDeleteAnnotation";

import { Paper, TextField, Button, Typography } from "@mui/material";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useMainBaseMapListing from "Features/baseMaps/hooks/useMainBaseMapListing";

export default function SectionEditScale() {
  const dispatch = useDispatch();

  // string

  const label = "Distance (m)";
  const saveS = "Enregistrer";

  // state

  const [targetDistance, setTargetDistance] = useState();

  // data

  const mainBaseMap = useMainBaseMap();
  const mainBaseMapListing = useMainBaseMapListing();
  const scaleInPx = useSelector((s) => s.mapEditor.scaleInPx);
  const updateEntity = useUpdateEntity();
  const scaleAnnotationId = useSelector((s) => s.mapEditor.scaleAnnotationId);
  const deleteAnnotation = useDeleteAnnotation();

  // helper

  const meterByPx = mainBaseMap?.meterByPx ?? 1;
  const currentDistance = scaleInPx * meterByPx;

  console.log("meterByPx", scaleInPx, meterByPx, "mainBaseMap", mainBaseMap);

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

  async function handleSave() {
    const updates = {
      meterByPx: targetDistance / scaleInPx,
    };

    await deleteAnnotation(scaleAnnotationId);
    await updateEntity(mainBaseMap?.id, updates, {
      listing: mainBaseMapListing,
    });

    dispatch(setScaleAnnotationId(null));
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
