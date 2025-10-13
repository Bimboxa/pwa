import { useSelector } from "react-redux";

import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";

import { Box, IconButton, Typography } from "@mui/material";
import { Edit } from "@mui/icons-material";

import AnnotationIcon from "Features/annotations/components/AnnotationIcon";

export default function SectionEntityAnnotationInRightPanel({
  entity,
  onEditClick,
}) {
  // strings

  const annotationS = "Annotation";

  // data

  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const spriteImage = useAnnotationSpriteImage();

  // helpers

  const annotation = entity.annotations?.find(
    (annotation) => annotation.baseMapId === selectedBaseMapId
  );

  // handlers

  function handleEditClick() {
    setOpenAnnotation(true);
  }

  if (!annotation) return null;

  return (
    <Box sx={{ width: 1, p: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: "bold" }}>
        {annotationS}
      </Typography>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <AnnotationIcon annotation={annotation} spriteImage={spriteImage} />
          <Typography variant="body2" sx={{ ml: 1 }}>
            {annotation.label}
          </Typography>
        </Box>
        <IconButton onClick={() => onEditClick(annotation)}>
          <Edit />
        </IconButton>
      </Box>
    </Box>
  );
}
