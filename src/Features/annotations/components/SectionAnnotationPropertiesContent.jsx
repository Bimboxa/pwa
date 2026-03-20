import { Box } from "@mui/material";

import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import {
  resolveDrawingShapeFromType,
  getConfigurableProps,
} from "Features/annotations/constants/drawingShapeConfig";

import FieldAnnotationPreview from "./FieldAnnotationPreview";
import FieldAnnotationHeight from "./FieldAnnotationHeight";
import SectionAnnotationQties from "./SectionAnnotationQties";
import ButtonAnnotationTemplate from "./ButtonAnnotationTemplate";
import FieldWrapperDimensions from "./FieldWrapperDimensions";
import FieldAnnotationRotation from "./FieldAnnotationRotation";
import FieldAnnotationFill from "./FieldAnnotationFill";
import FieldAnnotationStroke from "./FieldAnnotationStroke";
import FieldAnnotationIsEraser from "./FieldAnnotationIsEraser";

export default function SectionAnnotationPropertiesContent({ annotation }) {
  // data

  const updateAnnotation = useUpdateAnnotation();

  // helpers

  const type = annotation?.type;
  const overrideFields = annotation?.annotationTemplate?.overrideFields;

  const drawingShape = resolveDrawingShapeFromType(type);
  const configurableProps = getConfigurableProps(drawingShape);
  const showFill =
    configurableProps.includes("fillColor") ||
    configurableProps.includes("fillOpacity");
  const showStroke =
    configurableProps.includes("strokeColor") ||
    configurableProps.includes("strokeWidth");

  // handlers

  async function handleHeightChange(updatedAnnotation) {
    if (!updatedAnnotation?.id) return;
    await updateAnnotation({
      id: updatedAnnotation.id,
      height: updatedAnnotation.height,
    });
  }

  // render

  return (
    <>
      <Box sx={{ display: "flex", gap: 1, p: 1, width: 1 }}>
        <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <FieldAnnotationPreview annotation={annotation} imageHeight={80} />
        </Box>
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <FieldAnnotationHeight
            annotation={annotation}
            onChange={handleHeightChange}
          />
          <SectionAnnotationQties annotation={annotation} />
        </Box>
      </Box>

      <Box sx={{ p: 1, width: 1 }}>
        <ButtonAnnotationTemplate annotation={annotation} bgcolor="white" fullWidth />
      </Box>

      <Box sx={{ width: 1, p: 1, gap: 1, display: "flex", flexDirection: "column" }}>
        <FieldWrapperDimensions annotation={annotation} />
        <FieldAnnotationRotation annotation={annotation} />
        {showFill && <FieldAnnotationFill annotation={annotation} overrideFields={overrideFields} />}
        {showStroke && <FieldAnnotationStroke annotation={annotation} overrideFields={overrideFields} />}
        <FieldAnnotationIsEraser annotation={annotation} />
      </Box>
    </>
  );
}
