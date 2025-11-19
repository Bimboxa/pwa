import { useDispatch } from "react-redux";

import { setTempAnnotations } from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";

import getPolylinesFromContours from "Features/annotations/utils/getPolylinesFromContours";

import cv from "../services/opencvService";
import theme from "Styles/theme";

export default function PanelOpencv() {
  const dispatch = useDispatch();
  // strings

  const contoursS = "Détecter les contours";

  // data

  const baseMap = useMainBaseMap();

  // handlers

  async function detectContours() {
    dispatch(setEnabledDrawingMode("OPENCV"));
    // const image = baseMap?.image;
    // console.log("image", image);
    // await cv.load();
    // const countsByColor = await cv.getPixelsCountByColorAsync({
    //   imageUrl: image.imageUrlClient,
    // });
    // console.log("countsByColor", countsByColor);
    // //
    // let contours = [];
    // Object.entries(countsByColor).forEach(([color, count]) => {
    //   let _contours = count.contours;
    //   _contours.forEach((contour) => {
    //     if (contour.length > 3) {
    //       contours.push(contour);
    //     }
    //   });
    // });
    // const polylines = getPolylinesFromContours(
    //   contours,
    //   theme.palette.secondary.main,
    //   baseMap?.id
    // );
    // console.log("polylines", polylines);
    // dispatch(setTempAnnotations(polylines));
  }

  return (
    <BoxFlexVStretch sx={{ p: 1 }}>
      <ButtonGeneric
        onClick={detectContours}
        label={contoursS}
        variant="contained"
        color="secondary"
      />
    </BoxFlexVStretch>
  );
}
