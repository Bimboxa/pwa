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
import AnnotationIcon from "./AnnotationIcon";
import useAnnotationSpriteImage from "../hooks/useAnnotationSpriteImage";

export default function SelectorAnnotationTemplateVariantList({
  selectedAnnotationTemplateId,
  onChange,
  annotationTemplates,
  title = "Bibliothèque d'annotations",
  size = 18,
  showTitle = false,
}) {

  console.log("debug_1612_templateId", selectedAnnotationTemplateId);

  // strings

  const noTemplateS = "Aucun style prédéfini";
  const otherS = "Autre";

  // data

  const spriteImage = useAnnotationSpriteImage();

  // helpers

  const noTemplates = !annotationTemplates?.length > 0;
  const newTemplates =
    annotationTemplates?.filter((t) => t.isFromAnnotation)?.length > 0;

  if (noTemplates)
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2">{noTemplateS}</Typography>
      </Box>
    );

  // component

  const ListItem = ({ id, selected, annotation }) => {
    return (
      <ListItemButton
        divider
        key={id}
        selected={selected}
        size="small"
        onClick={() => onChange(selected ? null : id)}
      >
        <ListItemIcon>
          <AnnotationIcon
            annotation={annotation}
            spriteImage={spriteImage}
            size={size}
          />
        </ListItemIcon>
        <Typography
          variant="body2"
          sx={{ ml: 0, fontWeight: selected ? "bold" : "normal" }}
        >
          {annotation?.label}
        </Typography>
        {/* <ListItemText primary={label} /> */}
      </ListItemButton>
    );
  };
  return (
    <BoxFlexVStretch>
      {showTitle && <Typography sx={{ p: 2 }}>{title}</Typography>}
      <BoxFlexVStretch sx={{ overflow: "auto" }}>
        <List dense>
          {annotationTemplates
            ?.filter((t) => !t.isFromAnnotation)
            .map((annotationTemplate) => {
              const { fillColor, iconKey, id, label } = annotationTemplate;
              const selected = id === selectedAnnotationTemplateId;

              return (
                <ListItem
                  key={id}
                  id={id}
                  annotation={annotationTemplate}
                  selected={selected}
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
              sx={{
                borderTop: (theme) => `1px solid ${theme.palette.divider}`,
              }}
            >
              {annotationTemplates
                ?.filter((t) => t.isFromAnnotation)
                .map((annotationTemplate) => {
                  const { id } = annotationTemplate;
                  const selected = id === selectedAnnotationTemplateId;

                  return (
                    <ListItem
                      key={id}
                      id={id}
                      selected={selected}
                      annotation={annotationTemplate}
                    />
                  );
                })}
            </List>
          </Box>
        )}
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
