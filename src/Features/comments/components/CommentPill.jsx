import { forwardRef } from "react";

import { Box, Tooltip } from "@mui/material";

import { COMMENT_COLORS } from "../commentsDarkTheme";

// Round numbered pill of a comment — same look in the left strip and in the
// scene (LayerCommentPins). `active` = the comment opened in the panel.
const CommentPill = forwardRef(function CommentPill(
  {
    num,
    title,
    active = false,
    size = 30,
    tooltipPlacement = "right",
    onClick,
    sx,
  },
  ref
) {
  // render

  return (
    <Tooltip title={title || ""} placement={tooltipPlacement} arrow>
      <Box
        ref={ref}
        component="button"
        type="button"
        onClick={onClick}
        sx={{
          width: size,
          height: size,
          minWidth: size,
          flexShrink: 0,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          p: 0,
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: num > 99 ? 10 : 12,
          fontWeight: 600,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          border: "1.5px solid",
          borderColor: active
            ? COMMENT_COLORS.accentText
            : COMMENT_COLORS.borderStrong,
          bgcolor: active ? COMMENT_COLORS.accent : COMMENT_COLORS.surface,
          color: active ? COMMENT_COLORS.accentContrast : COMMENT_COLORS.text,
          boxShadow: "0 1px 4px rgba(0,0,0,0.45)",
          transition:
            "background-color 0.12s, border-color 0.12s, transform 0.12s",
          "&:hover": {
            borderColor: COMMENT_COLORS.accentText,
            bgcolor: active
              ? COMMENT_COLORS.accent
              : COMMENT_COLORS.surfaceRaised,
            transform: "scale(1.08)",
          },
          "&:focus-visible": {
            outline: `2px solid ${COMMENT_COLORS.accentText}`,
            outlineOffset: 2,
          },
          ...sx,
        }}
      >
        {num}
      </Box>
    </Tooltip>
  );
});

export default CommentPill;
