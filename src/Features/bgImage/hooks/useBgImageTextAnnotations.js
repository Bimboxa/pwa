import { useSelector } from "react-redux";
import useBgImageInMapEditor from "Features/mapEditor/hooks/useBgImageInMapEditor";

export default function useBgImageTextAnnotations() {
  // data

  const bgImageInMapEditor = useBgImageInMapEditor();
  const rawAnnotations = useSelector(
    (s) => s.bgImage.bgImageRawTextAnnotations
  );

  // edge

  if (!bgImageInMapEditor?.textAnnotations) return [];

  // main

  const textAnnotations = [];

  bgImageInMapEditor?.textAnnotations?.forEach((textAnnotation) => {
    if (rawAnnotations[textAnnotation.key]) {
      textAnnotations.push({
        id: textAnnotation.key,
        x: textAnnotation.position[0] / bgImageInMapEditor.width,
        y: textAnnotation.position[1] / bgImageInMapEditor.height,
        fontSize: textAnnotation.fontSize,
        fontWeight: textAnnotation.fontWeight,
        type: "TEXT",
        nodeType: "BG_IMAGE_TEXT",
        textValue: rawAnnotations[textAnnotation.key],
      });
    }
  });

  return textAnnotations;
}
