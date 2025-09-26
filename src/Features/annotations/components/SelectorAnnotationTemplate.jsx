import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { lighten } from "@mui/material/styles";

import MarkerIcon from "Features/markers/components/MarkerIcon";
import getPropsFromAnnotationTemplateId from "../utils/getPropsFromAnnotationTemplateId";

export default function SelectorAnnotationTemplate({
  selectedAnnotationTemplateId,
  onChange,
  annotationTemplates,
  spriteImage,
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
    <Box sx={{ width: 1, display: "flex", justifyContent: "center", p: 1 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {annotationTemplates?.map((annotationTemplate) => {
          const { id, fillColor: bgcolor, iconKey, label } = annotationTemplate;

          const selected = id === selectedAnnotationTemplateId;

          return (
            <Box
              key={id}
              sx={{
                bgcolor: selected ? bgcolor : lighten(bgcolor, 0.5),
                borderRadius: "50%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                mx: 1,
                //mb: 2,
              }}
            >
              <Tooltip title={label}>
                <IconButton
                  size="small"
                  onClick={() =>
                    onChange(selected ? null : annotationTemplate.id)
                  }
                >
                  <MarkerIcon
                    iconKey={iconKey}
                    spriteImage={spriteImage}
                    size={size}
                  />
                </IconButton>
              </Tooltip>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
