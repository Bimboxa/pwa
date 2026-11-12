import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Box, Link, Typography } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { COMMENT_BLOCK_TYPES } from "../constants/commentBlocks";
import { COMMENT_COLORS } from "../commentsDarkTheme";

import usePhotoImageUrl from "Features/photos/hooks/usePhotoImageUrl";
import normalizeLinkUrl from "../utils/normalizeLinkUrl";

// Links of the markdown text open in a new tab (the reader stays in the Krto).
const markdownComponents = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

function BlockText({ block }) {
  if (!block.markdown?.trim()) return null;
  return (
    <Box
      sx={{
        fontSize: 14,
        lineHeight: 1.6,
        color: "text.primary",
        overflowWrap: "anywhere",
        "& > :first-of-type": { mt: 0 },
        "& > :last-child": { mb: 0 },
        "& p": { my: 1 },
        "& h1, & h2, & h3, & h4": { mt: 2, mb: 1, lineHeight: 1.3 },
        "& h1": { fontSize: 18 },
        "& h2": { fontSize: 16 },
        "& h3, & h4": { fontSize: 14 },
        "& ul, & ol": { my: 1, pl: 2.5 },
        "& li": { my: 0.25 },
        "& a": { color: COMMENT_COLORS.accentText },
        "& code": {
          fontSize: 12.5,
          px: 0.5,
          borderRadius: 0.5,
          bgcolor: COMMENT_COLORS.surfaceRaised,
        },
        "& blockquote": {
          m: 0,
          my: 1,
          pl: 1.5,
          borderLeft: `3px solid ${COMMENT_COLORS.borderStrong}`,
          color: "text.secondary",
        },
        "& hr": {
          border: "none",
          borderTop: `1px solid ${COMMENT_COLORS.border}`,
          my: 1.5,
        },
        "& table": { borderCollapse: "collapse", my: 1, fontSize: 13 },
        "& th, & td": {
          border: `1px solid ${COMMENT_COLORS.border}`,
          px: 1,
          py: 0.5,
        },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {block.markdown}
      </ReactMarkdown>
    </Box>
  );
}

function BlockImage({ block }) {
  const url = usePhotoImageUrl(block.fileName);
  const ratio =
    block.imageSize?.width && block.imageSize?.height
      ? block.imageSize.width / block.imageSize.height
      : null;
  return (
    <Box component="figure" sx={{ m: 0 }}>
      <Box
        sx={{
          borderRadius: 1.5,
          overflow: "hidden",
          bgcolor: COMMENT_COLORS.surface,
          border: `1px solid ${COMMENT_COLORS.border}`,
          // reserves the height while the blob loads (no layout jump)
          ...(ratio && !url ? { aspectRatio: String(ratio) } : {}),
        }}
      >
        {url && (
          <Box
            component="img"
            src={url}
            alt={block.caption || ""}
            sx={{ display: "block", width: 1, height: "auto" }}
          />
        )}
      </Box>
      {block.caption && (
        <Typography
          component="figcaption"
          variant="caption"
          sx={{ display: "block", mt: 0.5, color: "text.secondary" }}
        >
          {block.caption}
        </Typography>
      )}
    </Box>
  );
}

function BlockLink({ block }) {
  const href = normalizeLinkUrl(block.url);
  if (!href) return null;
  let host = "";
  try {
    host = new URL(href).hostname.replace(/^www\./, "");
  } catch {
    host = "";
  }
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      underline="none"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 1,
        borderRadius: 1.5,
        border: `1px solid ${COMMENT_COLORS.border}`,
        bgcolor: COMMENT_COLORS.surface,
        color: "text.primary",
        "&:hover": { borderColor: COMMENT_COLORS.accentText },
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          {block.label?.trim() || host || href}
        </Typography>
        <Typography
          variant="caption"
          noWrap
          sx={{ display: "block", color: "text.secondary" }}
        >
          {block.label?.trim() ? href : host}
        </Typography>
      </Box>
      <OpenInNewIcon sx={{ fontSize: 16, color: COMMENT_COLORS.accentText }} />
    </Link>
  );
}

function BlockYoutube({ block }) {
  if (!block.videoId) return null;
  return (
    <Box
      sx={{
        position: "relative",
        width: 1,
        aspectRatio: "16 / 9",
        borderRadius: 1.5,
        overflow: "hidden",
        bgcolor: "#000",
        border: `1px solid ${COMMENT_COLORS.border}`,
      }}
    >
      <Box
        component="iframe"
        src={`https://www.youtube-nocookie.com/embed/${block.videoId}`}
        title="YouTube"
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        sx={{ position: "absolute", inset: 0, width: 1, height: 1, border: 0 }}
      />
    </Box>
  );
}

const BLOCK_COMPONENTS = {
  [COMMENT_BLOCK_TYPES.TEXT]: BlockText,
  [COMMENT_BLOCK_TYPES.IMAGE]: BlockImage,
  [COMMENT_BLOCK_TYPES.LINK]: BlockLink,
  [COMMENT_BLOCK_TYPES.YOUTUBE]: BlockYoutube,
};

// Read-only body of a comment: its blocks in order. Unknown block types
// (written by a newer version) are skipped.
export default function CommentBlocksRenderer({ blocks, emptyLabel }) {
  // helpers

  const items = (blocks ?? []).filter((b) => BLOCK_COMPONENTS[b?.type]);

  // render

  if (!items.length) {
    return emptyLabel ? (
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {emptyLabel}
      </Typography>
    ) : null;
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {items.map((block) => {
        const Block = BLOCK_COMPONENTS[block.type];
        return <Block key={block.id} block={block} />;
      })}
    </Box>
  );
}
