import { Box, Switch, Typography } from "@mui/material";

import AnnotationTemplateIcon from "./AnnotationTemplateIcon";

// One row per annotation template taking part in « Évider »: icon + label +
// count + switch (off = the annotations of that template do not cut). Shared
// by the 2D and the 3D dialogs.
export default function TemplateSwitchRowHollowOut({
  group,
  spriteImage,
  checked,
  onChange,
}) {
  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        pl: 0.5,
        py: 0.25,
        borderRadius: 1,
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 24,
          height: 24,
          mr: 1,
          flexShrink: 0,
          opacity: checked ? 1 : 0.4,
          filter: checked ? "none" : "grayscale(100%)",
        }}
      >
        <AnnotationTemplateIcon
          template={group.iconSource}
          size={18}
          spriteImage={spriteImage}
        />
      </Box>
      <Typography
        variant="body2"
        color={checked ? "text.primary" : "text.disabled"}
        sx={{
          flex: 1,
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          userSelect: "none",
        }}
      >
        {group.label}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mx: 1, flexShrink: 0 }}
      >
        {group.count}
      </Typography>
      <Switch
        size="small"
        checked={checked}
        onChange={(e) => onChange(group.key, e.target.checked)}
      />
    </Box>
  );
}
