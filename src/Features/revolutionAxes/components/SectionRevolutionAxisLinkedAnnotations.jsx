import { Box, Typography } from "@mui/material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import useRevolutionAxisLinkedTemplates from "../hooks/useRevolutionAxisLinkedTemplates";

// Section of the REVOLUTION_AXIS edit toolbar: the annotations revolved
// around the axis (profiles / circles on its vertical base maps), one row per
// annotation template with the count — display only.
export default function SectionRevolutionAxisLinkedAnnotations({ axisId }) {
  // strings

  const titleS = "Annotations en révolution";
  const emptyS = "Aucune annotation en révolution";

  // data

  const groups = useRevolutionAxisLinkedTemplates(axisId);

  // render

  return (
    <Box
      sx={{
        px: 1.25,
        py: 0.75,
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mb: groups.length > 0 ? 0.5 : 0 }}
      >
        {titleS}
      </Typography>

      {groups.length === 0 ? (
        <Typography
          variant="caption"
          sx={{ color: "text.disabled", fontStyle: "italic" }}
        >
          {emptyS}
        </Typography>
      ) : (
        groups.map(({ key, template, label, count }) => (
          <Box
            key={key}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.75,
              py: 0.25,
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                width: 18,
                height: 18,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <AnnotationTemplateIcon template={template ?? {}} size={16} />
            </Box>
            <Typography
              variant="body2"
              noWrap
              sx={{ flex: 1, minWidth: 0, fontSize: "0.8rem" }}
            >
              {label}
            </Typography>
            <Typography
              noWrap
              sx={{
                fontSize: "10px",
                fontFamily: "monospace",
                fontWeight: 500,
                color: "secondary.main",
                flexShrink: 0,
              }}
            >
              {`×${count}`}
            </Typography>
          </Box>
        ))
      )}
    </Box>
  );
}
