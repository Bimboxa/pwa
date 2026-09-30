import { Box, Divider } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import FieldWrapperDimensions from "./FieldWrapperDimensions";
import FieldAnnotationRotation from "./FieldAnnotationRotation";

// Dimensions + Rotation stacked as two one-line rows in a single card,
// separated by a divider — replaces the two former full-height sections.
export default function SectionAnnotationTransform({ annotation }) {
  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <FieldWrapperDimensions annotation={annotation} inline />
        <Divider />
        <FieldAnnotationRotation annotation={annotation} inline />
      </Box>
    </WhiteSectionGeneric>
  );
}
