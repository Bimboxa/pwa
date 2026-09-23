import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setImageScaleDraft } from "../mapEditorSlice";
import {
  setTempAnnotations,
  triggerAnnotationsUpdate,
} from "Features/annotations/annotationsSlice";

import useMainBaseMap from "../hooks/useMainBaseMap";
import useResetNewAnnotation from "Features/annotations/hooks/useResetNewAnnotation";

import { Box } from "@mui/material";

import FieldTextV2 from "Features/form/components/FieldTextV2";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";

import applyImageScaleService from "Features/imageAnnotations/services/applyImageScaleService";

// Body of PopperImageScale: the cote just drawn on the image measures
// `lengthInPx` on the plan; typing its real length rescales the image about
// the first clicked point (applyImageScaleService).
export default function SectionImageScale() {
  const dispatch = useDispatch();

  // strings

  const label = "Longueur (m)";
  const applyS = "Appliquer";
  const cancelS = "Annuler";

  // data

  const mainBaseMap = useMainBaseMap();
  const draft = useSelector((s) => s.mapEditor.imageScaleDraft);
  const resetNewAnnotation = useResetNewAnnotation();

  const meterByPx = mainBaseMap?.getMeterByPx?.();
  const lengthInPx = draft?.lengthInPx;

  // state

  const [distance, setDistance] = useState("");
  useEffect(() => {
    if (lengthInPx && meterByPx) {
      setDistance((lengthInPx * meterByPx).toFixed(3));
    }
  }, [lengthInPx, meterByPx]);

  // helpers

  const parsed = parseFloat(String(distance).replace(",", "."));
  const disabled = !(parsed > 0) || !(lengthInPx > 0) || !(meterByPx > 0);

  // handlers

  function cleanup() {
    dispatch(setImageScaleDraft(null));
    dispatch(setTempAnnotations([]));
    resetNewAnnotation();
  }

  async function handleApply() {
    if (disabled) return;
    await applyImageScaleService({
      annotationId: draft.annotationId,
      imageSize: mainBaseMap?.getImageSize?.(),
      baseMapMeterByPx: meterByPx,
      p1: draft.points?.[0],
      lengthInPx,
      targetMeters: parsed,
    });
    dispatch(triggerAnnotationsUpdate());
    cleanup();
  }

  // render

  return (
    <Box sx={{ width: 1, p: 1, display: "flex", flexDirection: "column", gap: 1 }}>
      <FieldTextV2
        value={distance}
        onChange={(v) => setDistance(v)}
        label={label}
        options={{ showAsLabelAndField: true }}
      />
      <BoxAlignToRight>
        <ButtonGeneric label={cancelS} onClick={cleanup} />
        <ButtonGeneric
          label={applyS}
          disabled={disabled}
          onClick={handleApply}
          sx={{ ml: 1 }}
          variant="contained"
          color="secondary"
        />
      </BoxAlignToRight>
    </Box>
  );
}
