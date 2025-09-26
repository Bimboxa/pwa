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
  const otherS = "Autre";

  // helpers

  const noTemplates = !annotationTemplates?.length > 0;
  const newTemplates =
    annotationTemplates.filter((t) => t.isFromAnnotation)?.length > 0;

  if (noTemplates)
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2">{noTemplateS}</Typography>
      </Box>
    );

  // component

  const ListItem = ({ id, selected, iconKey, fillColor, label }) => {
    return (
      <ListItemButton
        divider
        key={id}
        selected={selected}
        size="small"
        onClick={() => onChange(selected ? null : id)}
      >
        <ListItemIcon>
          <MarkerIcon
            iconKey={iconKey}
            fillColor={fillColor}
            spriteImage={spriteImage}
            size={24}
          />
        </ListItemIcon>
        <ListItemText primary={label} />
      </ListItemButton>
    );
  };
  return (
    <BoxFlexVStretch>
      <Typography sx={{ p: 2 }}>{title}</Typography>
      <List dense>
        {annotationTemplates
          ?.filter((t) => !t.isFromAnnotation)
          .map((annotationTemplate) => {
            const { fillColor, iconKey, id, label } = annotationTemplate;
            const selected = id === selectedAnnotationTemplateId;

            return (
              <ListItem
                id={id}
                selected={selected}
                fillColor={fillColor}
                iconKey={iconKey}
                label={label}
              />
            );
          })}
      </List>

      {newTemplates && (
        <Box
          sx={{
            mt: 2,
            width: 1,
          }}
        >
          <Typography sx={{ p: 2 }} variant="body2" color="text.secondary">
            {otherS}
          </Typography>
          <List
            dense
            sx={{ borderTop: (theme) => `1px solid ${theme.palette.divider}` }}
          >
            {annotationTemplates
              ?.filter((t) => t.isFromAnnotation)
              .map((annotationTemplate) => {
                const { fillColor, iconKey, id, label } = annotationTemplate;
                const selected = id === selectedAnnotationTemplateId;

                return (
                  <ListItem
                    id={id}
                    selected={selected}
                    fillColor={fillColor}
                    iconKey={iconKey}
                    label={label}
                  />
                );
              })}
          </List>
        </Box>
      )}
    </BoxFlexVStretch>
  );
}
