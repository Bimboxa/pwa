import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useCreateAnnotation from "../hooks/useCreateAnnotation";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";

import {
  setDrawingPolylinePoints,
  setEnabledDrawingMode,
  setSelectedNode,
} from "Features/mapEditor/mapEditorSlice";
import { setNewAnnotation } from "../annotationsSlice";

import { Box, Typography } from "@mui/material";

import FieldTextV2 from "Features/form/components/FieldTextV2";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";

export default function SectionEditedAnnotationNextPoint() {
  const dispatch = useDispatch();

  // strings

  const title = "Ajouter un point";

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const points = useSelector((s) => s.mapEditor.drawingPolylinePoints);
  const baseMap = useMainBaseMap();
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const listingId = useSelector((s) => s.listings.selectedListingId);
  const annotationTemplateId = useSelector(
    (s) => s.mapEditor.selectedAnnotationTemplateId
  );

  // data - func

  const createAnnotation = useCreateAnnotation();
  const createEntity = useCreateEntity();

  // state

  const [x, setX] = useState(0);
  const [y, setY] = useState(0);

  // helpers

  const { width, height } = baseMap?.image?.imageSize ?? {};
  const mx = baseMap?.meterByPx;
  const { x: x0, y: y0 } = points?.[points?.length - 1] ?? {};

  async function handleClick() {
    const nextPoint = {
      x: x0 + x / width / mx,
      y: y0 - y / height / mx,
      type: "square",
    };
    const newPoints = [...points, nextPoint];
    console.log("debug_2210_newPoints", newPoints);
    if (enabledDrawingMode === "POLYLINE") {
      dispatch(setDrawingPolylinePoints(newPoints));
    } else if (enabledDrawingMode === "RECTANGLE") {
      const entity = await createEntity({});

      // Create annotation with rectangle data
      const annotation = await createAnnotation(
        {
          ...newAnnotation,
          type: "RECTANGLE",
          points, // Store the points array (2 diagonal corners)
          entityId: entity?.id,
          listingId: listingId,
          baseMapId: baseMap?.id,
          annotationTemplateId,
        },
        {
          listingKey: listingId,
        }
      );

      console.log("[MainMapEditor] new rectangle created", annotation, entity);

      // Reset drawing mode
      dispatch(setEnabledDrawingMode(null));
      dispatch(setNewAnnotation({}));
      dispatch(setSelectedNode(null));
      dispatch(clearDrawingRectanglePoints()); // Clear rectangle points
    }

    setX(0);
    setY(0);
  }

  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
        {title}
      </Typography>
      <Box sx={{ display: "flex", gap: 1 }}>
        <FieldTextV2
          label="ΔX (m)"
          value={x}
          onChange={setX}
          options={{ isNumber: true, showLabel: true }}
        />
        <FieldTextV2
          label="ΔY(m)"
          value={y}
          onChange={setY}
          options={{ isNumber: true, showLabel: true }}
        />
      </Box>
      <BoxAlignToRight>
        <ButtonGeneric label="Ajouter" onClick={handleClick} />
      </BoxAlignToRight>
    </Box>
  );
}
