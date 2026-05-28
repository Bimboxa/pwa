import {Box} from "@mui/material";

// Responsive 16:9 video embed for documentation pages. Rendered in place of
// <img> when the Markdown image URL points to a known video provider
// (see resolveVideoEmbed).
export default function MarkdownVideo({embedSrc, title}) {
  if (!embedSrc) return null;

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        pt: "56.25%",
        my: 2,
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "common.black",
      }}
    >
      <Box
        component="iframe"
        src={embedSrc}
        title={title || "video"}
        loading="lazy"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        frameBorder={0}
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          border: 0,
        }}
      />
    </Box>
  );
}
