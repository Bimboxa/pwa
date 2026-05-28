import {
  Box,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import MarkdownCode from "./MarkdownCode";
import MarkdownImage from "./MarkdownImage";
import MarkdownLink from "./MarkdownLink";
import MarkdownVideo from "./MarkdownVideo";

import resolveVideoEmbed from "../../utils/resolveVideoEmbed";

// Factory: build the components map for react-markdown with page-scoped
// resolvers (image loaders, link routing) bound in.
export default function buildMarkdownComponents({pageId, imageLoaders}) {
  return {
    h1: ({node, ...props}) => (
      <Typography
        variant="h3"
        component="h1"
        sx={{mt: 0, mb: 2, fontWeight: 600}}
        {...props}
      />
    ),
    h2: ({node, ...props}) => (
      <Typography
        variant="h4"
        component="h2"
        sx={{mt: 5, mb: 1.5, fontWeight: 600, scrollMarginTop: 24}}
        {...props}
      />
    ),
    h3: ({node, ...props}) => (
      <Typography
        variant="h5"
        component="h3"
        sx={{mt: 3, mb: 1, fontWeight: 600, scrollMarginTop: 24}}
        {...props}
      />
    ),
    h4: ({node, ...props}) => (
      <Typography
        variant="h6"
        component="h4"
        sx={{mt: 2.5, mb: 1, fontWeight: 600}}
        {...props}
      />
    ),
    p: ({node, ...props}) => {
      // react-markdown wraps a standalone image in a <p>. When that image is a
      // video embed (rendered as a block <div>), a <div> inside <p> is invalid
      // HTML — drop the paragraph wrapper and render the embed directly.
      const onlyChild =
        node?.children?.length === 1 ? node.children[0] : null;
      if (
        onlyChild?.tagName === "img" &&
        resolveVideoEmbed(onlyChild.properties?.src)
      ) {
        return <>{props.children}</>;
      }
      return (
        <Typography variant="body1" sx={{my: 1.5, lineHeight: 1.7}} {...props} />
      );
    },
    a: ({node, ...props}) => <MarkdownLink pageId={pageId} {...props} />,
    img: ({node, src, alt, ...props}) => {
      const video = resolveVideoEmbed(src);
      if (video) return <MarkdownVideo embedSrc={video.embedSrc} title={alt} />;
      return (
        <MarkdownImage
          pageId={pageId}
          imageLoaders={imageLoaders}
          src={src}
          alt={alt}
          {...props}
        />
      );
    },
    code: MarkdownCode,
    hr: () => <Divider sx={{my: 3}} />,
    ul: ({node, ...props}) => (
      <Box component="ul" sx={{pl: 3, my: 1}} {...props} />
    ),
    ol: ({node, ...props}) => (
      <Box component="ol" sx={{pl: 3, my: 1}} {...props} />
    ),
    li: ({node, ...props}) => (
      <Box component="li" sx={{my: 0.5, lineHeight: 1.7}} {...props} />
    ),
    blockquote: ({node, ...props}) => (
      <Box
        component="blockquote"
        sx={{
          borderLeft: (t) => `4px solid ${t.palette.divider}`,
          pl: 2,
          ml: 0,
          my: 2,
          color: "text.secondary",
        }}
        {...props}
      />
    ),
    table: ({node, ...props}) => (
      <TableContainer sx={{my: 2}}>
        <Table size="small" {...props} />
      </TableContainer>
    ),
    thead: TableHead,
    tbody: TableBody,
    tr: TableRow,
    th: ({node, ...props}) => (
      <TableCell sx={{fontWeight: 600}} {...props} />
    ),
    td: ({node, ...props}) => <TableCell {...props} />,
  };
}
