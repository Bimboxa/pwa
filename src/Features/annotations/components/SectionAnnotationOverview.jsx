import { Box } from "@mui/material";

import FieldAnnotationPreview from "./FieldAnnotationPreview";
import FieldAnnotationHeight from "./FieldAnnotationHeight";
import SectionAnnotationQties from "./SectionAnnotationQties";
import useUpdateAnnotation from "../hooks/useUpdateAnnotation";

// ---------------------------------------------------------------------------
// SectionAnnotationOverview — white card with the annotation's shape preview
// on the left and, on the right, the height field followed by the quantities
// (rows layout: values right-aligned, even spacing). Used above the tabs of
// the panel's annotation subview.
// ---------------------------------------------------------------------------

export default function SectionAnnotationOverview({ annotation }) {
  // data

  const updateAnnotation = useUpdateAnnotation();

  // helpers

  const type = annotation?.type;

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
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        px: 2,
        py: 1.5,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 3,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <FieldAnnotationPreview annotation={annotation} imageHeight={80} />
      </Box>
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 1,
        }}
      >
        {type !== "LINEAR_LAYOUT" && (
          <FieldAnnotationHeight
            annotation={annotation}
            onChange={handleHeightChange}
          />
        )}
        <SectionAnnotationQties annotation={annotation} layout="rows" />
      </Box>
    </Box>
  );
}
