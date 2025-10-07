import {
  Box,
  ListItemButton,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import { Add } from "@mui/icons-material";
import { lighten } from "@mui/material/styles";

import MarkerIcon from "Features/markers/components/MarkerIcon";
import getPropsFromAnnotationTemplateId from "../utils/getPropsFromAnnotationTemplateId";
import AnnotationIcon from "./AnnotationIcon";

export default function SelectorAnnotationTemplateVariantHorizontal({
  selectedAnnotationTemplateId,
  onChange,
  onClick,
  onNewClick,
  annotationTemplates,
  spriteImage,
  size = 24,
}) {
  console.log("debug_2609_selectorAnnotationTemplate", annotationTemplates);

  // strings

  const noTemplateS = "Aucun style prédéfini";

  // helpers

  const noTemplates = !annotationTemplates?.length > 0;

  // helpers - sorted items

  const items1 = annotationTemplates?.filter((t) => !t.isFromAnnotation) ?? [];
  const items2 = annotationTemplates?.filter((t) => t.isFromAnnotation) ?? [];
  const items = [...items1, { isDivider: true }, ...items2];

  // handlers

  function handleClick(annotationTemplate) {
    console.log("handleClick", annotationTemplate);
    const id =
      annotationTemplate?.id === selectedAnnotationTemplateId
        ? null
        : annotationTemplate.id;
    if (onChange) onChange(id);
    if (onClick) onClick(annotationTemplate);
  }
  if (noTemplates)
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2">{noTemplateS}</Typography>
      </Box>
    );

  return (
    <Box sx={{ display: "flex", justifyContent: "center" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "top",
          //flexWrap: "wrap",
        }}
      >
        {items?.map((annotationTemplate) => {
          const { id, fillColor: bgcolor, iconKey, label } = annotationTemplate;

          const selected = id === selectedAnnotationTemplateId;

          if (annotationTemplate.isDivider)
            return (
              <Box
                sx={{
                  display: "flex",
                  width: "1px",
                  mx: 1,
                  borderRight: (theme) => `1px solid ${theme.palette.divider}`,
                }}
              />
            );

          return (
            <Box sx={{ bgcolor: "white", display: "flex" }}>
              <Tooltip title={label}>
                <ListItemButton
                  onClick={() => handleClick(annotationTemplate)}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    width: 70,
                    px: 0.5,
                    py: 1,
                  }}
                >
                  <Box
                    key={id}
                    sx={{
                      bgcolor: selected ? bgcolor : lighten(bgcolor, 0.5),
                      borderRadius: "50%",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      mx: 1,
                      mb: 2,
                    }}
                  >
                    <AnnotationIcon
                      annotation={annotationTemplate}
                      spriteImage={spriteImage}
                      size={size}
                    />
                  </Box>
                  <Box sx={{ width: 1 }}>
                    <Typography
                      sx={{ fontSize: 10 }}
                      align="center"
                      color={selected ? "text.primary" : "text.secondary"}
                    >
                      {label}
                    </Typography>
                  </Box>
                </ListItemButton>
              </Tooltip>
            </Box>
          );
        })}
        <ListItemButton onClick={onNewClick}>
          <Add />
        </ListItemButton>
      </Box>
    </Box>
  );
}
