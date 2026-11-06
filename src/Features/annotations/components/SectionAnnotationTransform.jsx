import { Box, Divider } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import FieldWrapperDimensions from "./FieldWrapperDimensions";
import FieldAnnotationRotation from "./FieldAnnotationRotation";
import FieldAnnotationVertexSnap3d from "./FieldAnnotationVertexSnap3d";

// Dimensions + Rotation stacked as two one-line rows in a single card,
// separated by a divider — replaces the two former full-height sections.
// An imported 3D object (OBJECT_3D) adds its 3D vertex snap switch.
export default function SectionAnnotationTransform({ annotation }) {
  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <FieldWrapperDimensions annotation={annotation} inline />
        <Divider />
        <FieldAnnotationRotation annotation={annotation} inline />
        {annotation?.type === "OBJECT_3D" && (
          <>
            <Divider />
            <FieldAnnotationVertexSnap3d annotation={annotation} />
          </>
        )}
      </Box>
    </WhiteSectionGeneric>
  );
}
