import { useMemo } from "react";
import { useSelector } from "react-redux";
import useBgImageInMapEditor from "Features/mapEditor/hooks/useBgImageInMapEditor";

// Stable reference for the (very common) "no bg image" case: this array is a
// dependency of the heavy `processed` memo of useAnnotationsV2 — a fresh `[]`
// per render would force that memo to re-run on EVERY consumer render.
const EMPTY = [];

export default function useBgImageTextAnnotations() {
  // data

  const bgImageInMapEditor = useBgImageInMapEditor();
  const rawAnnotations = useSelector(
    (s) => s.bgImage.bgImageRawTextAnnotations
  );

  // main

  return useMemo(() => {
    if (!bgImageInMapEditor?.textAnnotations) return EMPTY;

    return bgImageInMapEditor.textAnnotations.map((textAnnotation) => ({
      id: textAnnotation.key,
      x: textAnnotation.position[0] / bgImageInMapEditor.width,
      y: textAnnotation.position[1] / bgImageInMapEditor.height,
      textPoint: {
        x: textAnnotation.position[0],
        y: textAnnotation.position[1],
      },
      fontSize: textAnnotation.fontSize,
      fontWeight: textAnnotation.fontWeight,
      type: "TEXT",
      nodeType: "BG_IMAGE_TEXT",
      textValue: rawAnnotations?.[textAnnotation.key],
    }));
  }, [bgImageInMapEditor, rawAnnotations]);
}
