import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";

import { List, ListItemButton, Typography, Divider } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";
import IconButtonClose from "Features/layout/components/IconButtonClose";
import AnnotationIcon from "./AnnotationIcon";

export default function SectionListAnnotationTemplates({
  annotationTemplates,
  onClick,
  onClose,
}) {
  const spriteImage = useAnnotationSpriteImage();
  // render

  return (
    <BoxFlexVStretch>
      <BoxAlignToRight>
        <IconButtonClose onClose={onClose} />
      </BoxAlignToRight>
      <List dense>
        {annotationTemplates?.map((annotationTemplate, idx) => {
          if (!annotationTemplate?.isDivider)
            return (
              <ListItemButton
                key={annotationTemplate.id}
                onClick={() => onClick(annotationTemplate)}
              >
                <AnnotationIcon
                  annotation={annotationTemplate}
                  spriteImage={spriteImage}
                  size={18}
                />
                <Typography sx={{ ml: 1 }} variant="body2">
                  {annotationTemplate.label}
                </Typography>
              </ListItemButton>
            );
          if (annotationTemplate?.isDivider) return <Divider key={idx} />;
        })}
      </List>
    </BoxFlexVStretch>
  );
}
