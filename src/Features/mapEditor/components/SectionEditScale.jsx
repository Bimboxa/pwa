import { useState, useEffect } from "react";

import { useSelector, useDispatch } from "react-redux";

import {
  setAnchorPositionScale,
  setScaleAnnotationId,
} from "../mapEditorSlice";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useMainBaseMapListing from "Features/baseMaps/hooks/useMainBaseMapListing";

import useMainBaseMap from "../hooks/useMainBaseMap";

import useDeleteAnnotation from "Features/annotations/hooks/useDeleteAnnotation";
import useResetNewAnnotation from "Features/annotations/hooks/useResetNewAnnotation";

import { Paper, Button, Typography, Box, TextField } from "@mui/material";

import FieldTextV2 from "Features/form/components/FieldTextV2";
import IconButtonClose from "Features/layout/components/IconButtonClose";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";
import { setTempAnnotations } from "Features/annotations/annotationsSlice";

export default function SectionEditScale() {
  const dispatch = useDispatch();

  // string

  const label = "Distance (m)";
  const saveS = "Enregistrer";

  // data

  const mainBaseMap = useMainBaseMap();
  const mainBaseMapListing = useMainBaseMapListing();
  const scaleInPx = useSelector((s) => s.mapEditor.scaleInPx);
  const updateEntity = useUpdateEntity();
  const scaleAnnotationId = useSelector((s) => s.mapEditor.scaleAnnotationId);
  const deleteAnnotation = useDeleteAnnotation();
  const resetNewAnnotation = useResetNewAnnotation();

  const meterByPx = mainBaseMap?.meterByPx;

  // state

  const [distance, setDistance] = useState("");
  useEffect(() => {
    if (scaleInPx && meterByPx) {
      const _distance = scaleInPx * meterByPx
      setDistance(_distance.toFixed(3));
    }
  }, [scaleInPx, meterByPx])

  // helper - disabled

  const delta = distance - scaleInPx * meterByPx;
  const disabled = !distance || Math.abs(delta) < 0.0005;
  console.log("delta", delta)

  // helper

  let value = distance ?? "";

  // handlers

  function handleChange(distanceS) {
    //let distanceS = e.target.value;
    distanceS = distanceS.replace(",", ".");
    setDistance(distanceS);
  }

  async function handleSave() {
    const updates = {
      meterByPx: distance / scaleInPx,
    };

    await deleteAnnotation(scaleAnnotationId);
    await updateEntity(mainBaseMap?.id, updates, {
      listing: mainBaseMapListing,
    });

    dispatch(setScaleAnnotationId(null));
    dispatch(setAnchorPositionScale(null));
    resetNewAnnotation();
    dispatch(setTempAnnotations([]));
  }

  return (

    <Box sx={{ width: 1, p: 1, display: "flex", flexDirection: "column", gap: 1 }}>
      <FieldTextV2 value={value} onChange={handleChange} label={label} options={{ showAsLabelAndField: true }} />
      <BoxAlignToRight>
        <ButtonGeneric
          label={saveS}
          disabled={disabled}
          onClick={handleSave}
          sx={{ ml: 2 }}
          variant="contained"
          color="secondary"
        />
      </BoxAlignToRight>
    </Box>
  );
}
