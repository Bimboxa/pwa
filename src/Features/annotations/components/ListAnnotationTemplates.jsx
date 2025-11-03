import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";

import { List, ListItemButton, Typography } from "@mui/material";

import AnnotationIcon from "./AnnotationIcon";

export default function ListAnnotationTemplates({
  annotationTemplates,
  selection,
  onClick,
}) {
  // data

  const spriteImage = useAnnotationSpriteImage();

  // handlers

  function handleClick(annotationTemplate) {
    onClick(annotationTemplate);
  }

  return (
    <List dense>
      {annotationTemplates?.map((annotationTemplate) => (
        <ListItemButton
          key={annotationTemplate.id}
          onClick={() => handleClick(annotationTemplate)}
          selected={selection?.includes(annotationTemplate.id)}
          divider
        >
          <AnnotationIcon
            annotation={annotationTemplate}
            spriteImage={spriteImage}
            size={24}
          />
          <Typography variant="body2" sx={{ ml: 1 }}>
            {annotationTemplate.label}
          </Typography>
        </ListItemButton>
      ))}
    </List>
  );
}
