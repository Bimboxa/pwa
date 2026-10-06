import { Box, Typography } from "@mui/material";

import TutorialImageButton from "./TutorialImageButton";

import resolveTutorialImagePath from "../utils/resolveTutorialImagePath";

// react-markdown hands the hast `node` to every component: strip it before
// spreading the rest on a DOM / MUI element.
function domProps(props) {
  const rest = { ...props };
  delete rest.node;
  return rest;
}

// Compact react-markdown components for the tutorial panel (340px wide):
// "##" = section title, ordered list = numbered steps (CSS counter badge),
// "![alt](./assets/x.svg)" = image icon opening the picture on click.
export default function buildTutorialMarkdownComponents({
  orgaCode,
  basePath,
}) {
  return {
    h1: (props) => (
      <Typography
        variant="subtitle1"
        component="h2"
        sx={{ fontWeight: 600, mt: 1, mb: 1 }}
        {...domProps(props)}
      />
    ),
    h2: (props) => (
      <Typography
        variant="overline"
        component="h3"
        sx={{
          display: "block",
          mt: 2.5,
          mb: 0.5,
          fontWeight: 600,
          lineHeight: 1.6,
          color: "text.secondary",
          "&:first-of-type": { mt: 0.5 },
        }}
        {...domProps(props)}
      />
    ),
    h3: (props) => (
      <Typography
        variant="subtitle2"
        component="h4"
        sx={{ mt: 1.5, mb: 0.5, fontWeight: 600 }}
        {...domProps(props)}
      />
    ),
    p: (props) => (
      <Typography
        variant="body2"
        sx={{ my: 1, color: "text.secondary", lineHeight: 1.6 }}
        {...domProps(props)}
      />
    ),
    ol: (props) => (
      <Box
        component="ol"
        sx={{
          listStyle: "none",
          counterReset: "tutorial-step",
          m: 0,
          p: 0,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
        {...domProps(props)}
      />
    ),
    ul: (props) => (
      <Box component="ul" sx={{ pl: 2.5, my: 0.5 }} {...domProps(props)} />
    ),
    li: (props) => (
      <Box
        component="li"
        sx={{
          counterIncrement: "tutorial-step",
          display: "flex",
          alignItems: "flex-start",
          gap: 1.25,
          typography: "body2",
          lineHeight: 1.6,
          // step number badge
          "ol > &::before": {
            content: "counter(tutorial-step)",
            flexShrink: 0,
            width: 22,
            height: 22,
            mt: "1px",
            borderRadius: "50%",
            bgcolor: "action.selected",
            color: "text.primary",
            fontSize: 12,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          },
        }}
      >
        <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
          {props.children}
        </Box>
      </Box>
    ),
    img: ({ src, alt }) => (
      <TutorialImageButton
        orgaCode={orgaCode}
        relativePath={resolveTutorialImagePath(src, basePath)}
        alt={alt}
      />
    ),
    a: (props) => (
      <Box
        component="a"
        target="_blank"
        rel="noopener noreferrer"
        sx={{ color: "primary.main" }}
        {...domProps(props)}
      />
    ),
    code: (props) => (
      <Box
        component="code"
        sx={{
          px: 0.5,
          borderRadius: 0.5,
          bgcolor: "action.hover",
          fontSize: "0.85em",
        }}
        {...domProps(props)}
      />
    ),
  };
}
