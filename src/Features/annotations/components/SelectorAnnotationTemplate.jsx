import { Box, IconButton, Tooltip } from "@mui/material";
import { lighten } from "@mui/material/styles";
import theme from "Styles/theme";

import MarkerIcon from "Features/markers/components/MarkerIcon";

export default function SelectorAnnotationTemplate({
  selectedAnnotationTemplateId,
  onChange,
  annotationTemplates,
  spriteImage,
}) {
  const size = 18;

  //const bgcolor = theme.palette.primary.main;
  const bgcolorDefault = theme.palette.grey[400];

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
          const bgcolor = annotationTemplate?.fillColor;
          const iconKey = annotationTemplate?.iconKey;
          const id = annotationTemplate.id;
          const label = annotationTemplate.label;
          const selected =
            annotationTemplate.id === selectedAnnotationTemplateId;

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
                mb: 2,
              }}
            >
              <Tooltip title={label}>
                <IconButton
                  size="small"
                  onClick={() => onChange(annotationTemplate.id)}
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
