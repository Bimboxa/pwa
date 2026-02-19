import { useSelector, useDispatch } from "react-redux";

import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";

import { setSelectedItem } from "Features/selection/selectionSlice";

import { Box, IconButton, List, ListItemButton, Typography } from "@mui/material";
import { Edit } from "@mui/icons-material";

import AnnotationIcon from "Features/annotations/components/AnnotationIcon";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

export default function SectionEntityAnnotations({
  entity,
}) {
  const dispatch = useDispatch();

  // strings

  const annotationS = "Annotations";

  // data

  const spriteImage = useAnnotationSpriteImage();

  // handlers

  function handleClick(annotation) {
    console.log("click", annotation);
    //
    dispatch(setSelectedItem({
      id: annotation.id,
      type: "NODE",
      nodeType: "ANNOTATION",
      nodeId: annotation.id,
      annotationType: annotation.type,
      listingId: annotation.listingId,
      entityId: annotation.entityId,
    }))
  }

  if (!entity?.annotations?.length) return null;

  return (
    <WhiteSectionGeneric>
      <Typography variant="body2" sx={{ fontWeight: "bold", mb: 1 }}>
        {annotationS}
      </Typography>

      <List
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: 1,
        }}
      >{entity?.annotations?.map(annotation => {
        return <ListItemButton key={annotation.id} dense onClick={() => handleClick(annotation)}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <AnnotationIcon annotation={annotation} spriteImage={spriteImage} />
            <Typography variant="body2" sx={{ ml: 1 }}>
              {annotation.label}
            </Typography>
          </Box>
        </ListItemButton>

      })}
      </List>

    </WhiteSectionGeneric >
  );
}
