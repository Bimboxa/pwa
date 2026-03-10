import { Box, Typography, IconButton } from "@mui/material";
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from "@mui/icons-material";

import AnnotationIcon from "Features/annotations/components/AnnotationIcon";

const ICON_SIZE = 18;

export default function SectionAnnotationVisibility({
  legendItems,
  disabledAnnotationTemplates,
  spriteImage,
  onToggleTemplate,
  onToggleListing,
}) {
  // helpers

  const groupedItems = [];
  let currentGroup = null;

  legendItems.forEach((item) => {
    if (item.type === "listingName") {
      if (currentGroup) groupedItems.push(currentGroup);
      currentGroup = { listingName: item.name, templates: [] };
    } else if (currentGroup) {
      currentGroup.templates.push(item);
    }
  });
  if (currentGroup) groupedItems.push(currentGroup);

  // render

  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: "bold" }}>
        Annotations
      </Typography>

      <Box
        sx={{
          mt: 0.5,
          borderRadius: "4px",
          border: (theme) => `1px solid ${theme.palette.divider}`,
          overflow: "hidden",
        }}
      >
        {groupedItems.map((group, groupIdx) => {
          const allDisabled = group.templates.every((t) =>
            disabledAnnotationTemplates.includes(t.id)
          );

          return (
            <Box
              key={group.listingName}
              sx={{}}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  px: 1,
                  py: 0.25,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: "bold",
                    flex: 1,
                    minWidth: 0,
                    color: allDisabled ? "text.disabled" : "text.primary",
                  }}
                >
                  {group.listingName}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => onToggleListing(group.listingName)}
                  sx={{ width: 28, height: 28, flexShrink: 0 }}
                >
                  {allDisabled ? (
                    <VisibilityOffIcon sx={{ fontSize: ICON_SIZE }} />
                  ) : (
                    <VisibilityIcon sx={{ fontSize: ICON_SIZE }} />
                  )}
                </IconButton>
              </Box>

              {group.templates.map((template) => {
                const isDisabled = disabledAnnotationTemplates.includes(
                  template.id
                );
                return (
                  <Box
                    key={template.id}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      pl: 2,
                      pr: 1,
                      py: 0.25,
                      opacity: isDisabled ? 0.4 : 1,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <AnnotationIcon
                        annotation={template}
                        spriteImage={spriteImage}
                        size={16}
                      />
                      <Typography variant="caption" noWrap>
                        {template.label}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={() => onToggleTemplate(template.id)}
                      sx={{ width: 28, height: 28, flexShrink: 0 }}
                    >
                      {isDisabled ? (
                        <VisibilityOffIcon sx={{ fontSize: ICON_SIZE }} />
                      ) : (
                        <VisibilityIcon sx={{ fontSize: ICON_SIZE }} />
                      )}
                    </IconButton>
                  </Box>
                );
              })}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
