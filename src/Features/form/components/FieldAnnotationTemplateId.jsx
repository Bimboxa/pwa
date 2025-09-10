import { Box, Typography } from "@mui/material";

import SelectorAnnotationTemplate from "Features/annotations/components/SelectorAnnotationTemplate";

export default function FieldAnnotationTemplateId({
  value,
  onChange,
  label,
  options,
}) {
  const spriteImage = options?.spriteImage;
  const annotationTemplates = options?.annotationTemplates ?? [];

  return (
    <Box sx={{ width: 1 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 1,
          borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {label}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "center", p: 1 }}>
        <SelectorAnnotationTemplate
          selectedAnnotationTemplateId={value}
          annotationTemplates={annotationTemplates}
          onChange={onChange}
          spriteImage={spriteImage}
        />
      </Box>
    </Box>
  );
}
