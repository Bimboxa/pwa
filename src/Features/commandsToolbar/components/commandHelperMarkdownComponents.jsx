import { Box, Typography } from "@mui/material";

// react-markdown hands the hast `node` to every component: strip it before
// spreading the rest on a DOM / MUI element.
function domProps(props) {
  const rest = { ...props };
  delete rest.node;
  return rest;
}

// Components rendering the description of a command helper
// (Data/<org>/commands/<KEY>.md) in DialogCommandHelper: plain paragraphs,
// lists, inline code — no images (the gif of the frontmatter is the only
// visual), no headings hierarchy beyond a bold line.
const commandHelperMarkdownComponents = {
  h1: (props) => (
    <Typography
      variant="subtitle2"
      component="p"
      sx={{ fontWeight: 600, mt: 1.5, mb: 0.5 }}
      {...domProps(props)}
    />
  ),
  h2: (props) => (
    <Typography
      variant="subtitle2"
      component="p"
      sx={{ fontWeight: 600, mt: 1.5, mb: 0.5 }}
      {...domProps(props)}
    />
  ),
  h3: (props) => (
    <Typography
      variant="subtitle2"
      component="p"
      sx={{ fontWeight: 600, mt: 1.5, mb: 0.5 }}
      {...domProps(props)}
    />
  ),
  p: (props) => (
    <Typography variant="body2" sx={{ mb: 1 }} {...domProps(props)} />
  ),
  ul: (props) => (
    <Box component="ul" sx={{ pl: 2.5, my: 0.5 }} {...domProps(props)} />
  ),
  ol: (props) => (
    <Box component="ol" sx={{ pl: 2.5, my: 0.5 }} {...domProps(props)} />
  ),
  li: (props) => (
    <Typography
      variant="body2"
      component="li"
      sx={{ mb: 0.5 }}
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
        fontFamily: "monospace",
        fontSize: "0.8em",
      }}
      {...domProps(props)}
    />
  ),
  a: (props) => (
    <Box
      component="a"
      target="_blank"
      rel="noreferrer"
      sx={{ color: "primary.main" }}
      {...domProps(props)}
    />
  ),
  // Images stay out of the description (the gif of the frontmatter is the
  // single visual of a helper).
  img: () => null,
};

export default commandHelperMarkdownComponents;
