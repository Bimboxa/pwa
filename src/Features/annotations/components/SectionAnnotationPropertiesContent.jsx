import { Box, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import {
  resolveDrawingShape,
  getConfigurableProps,
} from "Features/annotations/constants/drawingShapeConfig";

import FieldAnnotationPreview from "./FieldAnnotationPreview";
import FieldAnnotationHeight from "./FieldAnnotationHeight";
import SectionAnnotationQties from "./SectionAnnotationQties";
import SectionAnnotationPentes from "./SectionAnnotationPentes";
import SectionAnnotationSubtractions from "./SectionAnnotationSubtractions";
import SectionAnnotationOpenings from "./SectionAnnotationOpenings";
import ButtonAnnotationTemplate from "./ButtonAnnotationTemplate";
import FieldWrapperDimensions from "./FieldWrapperDimensions";
import FieldAnnotationRotation from "./FieldAnnotationRotation";
import FieldAnnotationFill from "./FieldAnnotationFill";
import FieldAnnotationStroke from "./FieldAnnotationStroke";
import FieldAnnotationStrokeWidth from "./FieldAnnotationStrokeWidth";
import FieldAnnotationIsEraser from "./FieldAnnotationIsEraser";
import FieldAnnotationIsExt from "./FieldAnnotationIsExt";
import FieldAnnotationIsLayer from "./FieldAnnotationIsLayer";
import FieldAnnotationIsProfile from "./FieldAnnotationIsProfile";
import FieldAnnotationLabel from "./FieldAnnotationLabel";
import FieldAnnotationLinearLayout from "./FieldAnnotationLinearLayout";
import FieldAnnotationOpening from "./FieldAnnotationOpening";
import FieldAnnotationArrows from "./FieldAnnotationArrows";
import FieldAnnotationFreeText from "./FieldAnnotationFreeText";
import FieldAnnotationTextContent from "./FieldAnnotationTextContent";

// hideOverview: the hosting panel renders the preview / height / quantities
// card and the label field itself, above the tabs (panel annotation subview)
// — skip them here to avoid the duplicate.
export default function SectionAnnotationPropertiesContent({
  annotation,
  hideOverview,
}) {
  // data

  const updateAnnotation = useUpdateAnnotation();

  // helpers

  const type = annotation?.type;
  const overrideFields = annotation?.annotationTemplate?.overrideFields;

  // Resolve from the annotation itself, not from its type alone: shapes that
  // share a type with another shape (or carry their own, like RULER) would
  // otherwise fall back to the wrong section set.
  const drawingShape = resolveDrawingShape(annotation);
  const configurableProps = getConfigurableProps(drawingShape);
  // FREE_TEXT: all colors live in its grouped field — skip the fill section.
  const isFreeText = configurableProps.includes("fontFamily");
  const showFill =
    !isFreeText &&
    (configurableProps.includes("fillColor") ||
      configurableProps.includes("fillOpacity"));
  const showStroke = configurableProps.includes("strokeColor");
  const showStrokeWidth = configurableProps.includes("strokeWidth");

  // handlers

  async function handleHeightChange(updatedAnnotation) {
    if (!updatedAnnotation?.id) return;
    await updateAnnotation({
      id: updatedAnnotation.id,
      height: updatedAnnotation.height,
    });
  }

  // LINEAR_LAYOUT: band width L (bar length, meters) — replaces the height
  // field (same rule as the edit toolbar).
  async function handleWidthChange(updatedAnnotation) {
    if (!updatedAnnotation?.id) return;
    await updateAnnotation({
      id: updatedAnnotation.id,
      width: updatedAnnotation.width,
    });
  }

  // render

  return (
    <>
      {!hideOverview && (
        <Box sx={{ display: "flex", gap: 1, p: 1, width: 1 }}>
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FieldAnnotationPreview annotation={annotation} imageHeight={80} />
          </Box>
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            {type !== "LINEAR_LAYOUT" && (
              <FieldAnnotationHeight
                annotation={annotation}
                onChange={handleHeightChange}
              />
            )}
            <SectionAnnotationQties annotation={annotation} />
          </Box>
        </Box>
      )}

      <SectionAnnotationPentes annotation={annotation} />

      <Box sx={{ p: 1, width: 1 }}>
        <ButtonAnnotationTemplate
          annotation={annotation}
          bgcolor="white"
          fullWidth
        />
      </Box>

      <Box
        sx={{
          width: 1,
          p: 1,
          gap: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <FieldWrapperDimensions annotation={annotation} />
        <FieldAnnotationRotation annotation={annotation} />
        {/* LINEAR_LAYOUT: band width L (bar length) — same section as the
            template form, without the override padlock. */}
        {type === "LINEAR_LAYOUT" && (
          <WhiteSectionGeneric>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
                Largeur
              </Typography>
              <FieldAnnotationHeight
                annotation={annotation}
                field="width"
                label=""
                onChange={handleWidthChange}
              />
            </Box>
          </WhiteSectionGeneric>
        )}
        {type === "LINEAR_LAYOUT" && (
          <FieldAnnotationLinearLayout annotation={annotation} />
        )}
        {drawingShape === "CIRCULATION" && (
          <FieldAnnotationArrows annotation={annotation} />
        )}
        {drawingShape === "OPENING" && (
          <FieldAnnotationOpening
            annotation={annotation}
            overrideFields={overrideFields}
          />
        )}
        {isFreeText && <FieldAnnotationTextContent annotation={annotation} />}
        {isFreeText && <FieldAnnotationFreeText annotation={annotation} />}
        {showFill && (
          <FieldAnnotationFill
            annotation={annotation}
            overrideFields={overrideFields}
          />
        )}
        {showStroke && (
          <FieldAnnotationStroke
            annotation={annotation}
            overrideFields={overrideFields}
          />
        )}
        {showStrokeWidth && (
          <FieldAnnotationStrokeWidth
            annotation={annotation}
            overrideFields={overrideFields}
          />
        )}
        {!hideOverview && <FieldAnnotationLabel annotation={annotation} />}
        <FieldAnnotationIsProfile annotation={annotation} />
        <FieldAnnotationIsEraser annotation={annotation} />
        {["POLYLINE", "STRIP", "POLYGON"].includes(type) && (
          <FieldAnnotationIsExt annotation={annotation} />
        )}
        {type === "STRIP" && <FieldAnnotationIsLayer annotation={annotation} />}
      </Box>

      {["POLYGON", "RECTANGLE", "POLYLINE", "STRIP"].includes(type) && (
        <SectionAnnotationSubtractions annotation={annotation} />
      )}

      <SectionAnnotationOpenings annotation={annotation} />
    </>
  );
}
