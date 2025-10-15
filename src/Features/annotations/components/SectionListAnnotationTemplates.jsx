import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";

import { List, ListItemButton, Typography, Divider } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";
import IconButtonClose from "Features/layout/components/IconButtonClose";
import AnnotationIcon from "./AnnotationIcon";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";

export default function SectionListAnnotationTemplates({
  annotationTemplates,
  onClick,
  onClose,
}) {
  // strings

  const title = "Bibliothèque";

  // data

  const spriteImage = useAnnotationSpriteImage();

  // render

  return (
    <BoxFlexVStretch>
      <HeaderTitleClose title={title} onClose={onClose} />

      <List sx={{ bgcolor: "white" }}>
        {annotationTemplates?.map((annotationTemplate, idx) => {
          if (!annotationTemplate?.isDivider)
            return (
              <ListItemButton
                key={annotationTemplate.id}
                onClick={() => onClick(annotationTemplate)}
                divider
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
