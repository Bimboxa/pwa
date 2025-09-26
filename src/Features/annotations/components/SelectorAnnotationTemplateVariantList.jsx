import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
} from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import MarkerIcon from "Features/markers/components/MarkerIcon";

import getPropsFromAnnotationTemplateId from "../utils/getPropsFromAnnotationTemplateId";

export default function SelectorAnnotationTemplateVariantList({
  selectedAnnotationTemplateId,
  onChange,
  annotationTemplates,
  spriteImage,
  title = "Bibliothèque d'annotations",
  size = 18,
}) {
  // strings

  const noTemplateS = "Aucun style prédéfini";

  // helpers

  const noTemplates = !annotationTemplates?.length > 0;

  if (noTemplates)
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2">{noTemplateS}</Typography>
      </Box>
    );

  return (
    <BoxFlexVStretch>
      <Typography sx={{ p: 2 }}>{title}</Typography>
      <List dense>
        {annotationTemplates?.map((annotationTemplate) => {
          const { fillColor, iconKey } = getPropsFromAnnotationTemplateId(
            annotationTemplate?.id
          );
          const bgcolor = fillColor;
          const id = annotationTemplate.id;
          const label = annotationTemplate.label;
          const selected =
            annotationTemplate.id === selectedAnnotationTemplateId;

          return (
            <ListItemButton
              key={id}
              selected={selected}
              size="small"
              onClick={() => onChange(selected ? null : annotationTemplate.id)}
            >
              <ListItemIcon>
                <MarkerIcon
                  iconKey={iconKey}
                  fillColor={bgcolor}
                  spriteImage={spriteImage}
                  size={24}
                />
              </ListItemIcon>
              <ListItemText primary={label} />
            </ListItemButton>
          );
        })}
      </List>
    </BoxFlexVStretch>
  );
}
